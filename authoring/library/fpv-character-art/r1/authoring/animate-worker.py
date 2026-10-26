import os
"""Original, in-place MakeHuman GameEngine motion authoring for this task.

Call build_worker_actions(armature) after preparing the live rig. Baking only
joint poses keeps locomotion/contacts entirely under the encounter authority.
Coordinates here are Blender Z-up, character facing -Y. No external code loads.
"""
import math
import bpy
from mathutils import Quaternion, Vector

def smooth(t):
    t = max(0., min(1., t))
    return t*t*(3.-2.*t)

def direction(arm, name, world_direction):
    """Orient a bone's Y axis in armature space, retaining its rest roll."""
    bone = arm.pose.bones[name]
    parent_rotation = Quaternion()
    if bone.parent:
        parent_rotation = (bone.parent.matrix.to_quaternion() @
                           bone.parent.bone.matrix_local.to_quaternion().inverted())
    rest = parent_rotation @ bone.bone.matrix_local.to_quaternion()
    target = rest.inverted() @ Vector(world_direction).normalized()
    bone.rotation_quaternion = Vector((0,1,0)).rotation_difference(target)
    bpy.context.view_layer.update()

def rotate(arm, name, axis, angle):
    bone = arm.pose.bones[name]
    rest = bone.bone.matrix_local.to_quaternion()
    bone.rotation_quaternion = rest.inverted() @ Quaternion(Vector(axis),angle) @ rest
    bpy.context.view_layer.update()

def place_leg(arm, side, ankle):
    thigh, calf = arm.pose.bones['thigh_'+side], arm.pose.bones['calf_'+side]
    hip = thigh.head.copy()
    vector = Vector(ankle)-hip
    distance = max(.01,min(vector.length,thigh.length+calf.length-.003))
    along = vector.normalized()
    bend = Vector((0,-1,0)); bend -= along * bend.dot(along); bend.normalize()
    cosine = max(-1.,min(1.,(thigh.length**2+distance**2-calf.length**2)/(2*thigh.length*distance)))
    knee = hip + along*(thigh.length*cosine) + bend*(thigh.length*math.sqrt(1.-cosine*cosine))
    direction(arm,'thigh_'+side,knee-hip)
    direction(arm,'calf_'+side,Vector(ankle)-arm.pose.bones['calf_'+side].head)
    # Heel stays level during stance; the ball/toe follows a small push-off.
    direction(arm,'foot_'+side,(0,-.1135,-.0575))

def pose_worker(arm, kind, phase):
    wave = math.tau * phase
    for bone in arm.pose.bones:
        bone.rotation_mode='QUATERNION'
        bone.rotation_quaternion=Quaternion()
        bone.location=(0,0,0)
        bone.scale=(1,1,1)
    bpy.context.view_layer.update()
    speed = 1. if kind=='walk' else 1.55 if kind=='run' else 0.
    # The root never translates. Pelvic sway is local cosmetic articulation.
    pelvis = arm.pose.bones['pelvis']
    sway = .012*math.sin(wave) if speed else .003*math.sin(wave)
    dip = (-.045 if kind=='walk' else -.065) + .011*math.cos(2*wave) if speed else -.01
    pelvis.location = pelvis.bone.matrix_local.to_quaternion().inverted() @ Vector((sway,0,dip))
    rotate(arm,'pelvis',(0,0,1),.055*math.sin(wave) if speed else .012*math.sin(wave))
    rotate(arm,'spine_01',(0,0,1),-.045*math.sin(wave) if speed else -.012*math.sin(wave))
    rotate(arm,'spine_02',(1,0,0),.045 if speed else .01*math.sin(wave))
    rotate(arm,'spine_03',(1,0,0),.05 if kind=='run' else .015*math.sin(wave))
    rotate(arm,'head',(0,0,1),.025*math.sin(wave) if speed else .10*math.sin(wave))
    attack = 0.
    if kind=='warning':
        attack=smooth(phase/.4)*(1.-smooth((phase-.78)/.22))
        recoil=math.exp(-((phase-.62)/.055)**2)
        rotate(arm,'spine_03',(1,0,0),.07*attack-.095*recoil)
        rotate(arm,'head',(0,0,1),-.035*attack)
    for side, sign in [('l',1),('r',-1)]:
        p=(phase+(0 if side=='l' else .5))%1.
        forward=0.; lift=0.
        if speed:
            swing=.4 if kind=='walk' else .48
            stride=.23 if kind=='walk' else .34
            if p<swing:
                v=p/swing
                forward=-stride+2*stride*smooth(v)
                lift=(.105 if kind=='walk' else .19)*math.sin(math.pi*v)
            else:
                forward=stride-2*stride*(p-swing)/(1-swing)
        place_leg(arm,side,(sign*.135,-.014-forward,.065+lift))
        if speed:
            rotate(arm,'ball_'+side,(1,0,0),.10*max(0.,math.sin(math.tau*p)))
        swing_arm=(-1 if side=='l' else 1)*.22*math.sin(wave)*speed
        upper=Vector((sign*.12,swing_arm,-1.)).normalized()
        lower=Vector((sign*.04,swing_arm-.10,-1.)).normalized()
        if kind=='run':
            lower=Vector((sign*.06,swing_arm-.75,-.6)).normalized()
        if attack:
            upper=upper.lerp(Vector((-sign*.18,-.78,-.55)).normalized(),attack)
            lower=lower.lerp(Vector((-sign*.10,-1.,.12)).normalized(),attack)
        direction(arm,'upperarm_'+side,upper)
        direction(arm,'lowerarm_'+side,lower)
        # Relaxed hands close during the visibly prepared pulse action.
        for finger in ['index','middle','ring','pinky']:
            for segment in range(1,4):
                name=f'{finger}_{segment:02d}_{side}'
                rotate(arm,name,(1,0,0),(.18+.42*attack)*(.8 if segment==1 else 1))
    bpy.context.view_layer.update()

def build_worker_actions(arm, fps=30):
    assert arm.type=='ARMATURE' and len(arm.data.bones)<=64
    arm.animation_data_create()
    bpy.context.scene.render.fps=fps
    actions=[]
    for name,frames in [('idle',90),('walk',36),('run',24),('warning',42)]:
        action=bpy.data.actions.new(name)
        arm.animation_data.action=action
        for frame in range(frames+1):
            bpy.context.scene.frame_set(frame)
            pose_worker(arm,name,frame/frames)
            for bone in arm.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
            arm.pose.bones['pelvis'].keyframe_insert('location',frame=frame,group='pelvis')
        action.use_fake_user=True
        # Explicit linear samples avoid overshooting extremities between keys.
        if hasattr(action,'fcurves'):
            for curve in action.fcurves:
                for key in curve.keyframe_points:key.interpolation='LINEAR'
        actions.append(action)
        arm.animation_data.action=None
    arm.animation_data.action=actions[0]
    bpy.context.scene.frame_set(0)
    return actions
