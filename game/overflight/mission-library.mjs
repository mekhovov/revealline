/** Read-only discovery. The mode/compiler and installed owner retain authority. */
export function overflightMissionSource({
  id,
  entries,
  mode,
  locale = () => 'en',
  installed = false,
  launch,
  progress = () => null,
}) {
  const local = (value) => value?.[locale()] ?? value?.en ?? '';
  const title = () =>
    locale() === 'uk'
      ? mode.id === 'overflight-hunt'
        ? 'Наліт'
        : 'Виживання'
      : mode.id === 'overflight-hunt'
        ? 'Raid'
        : 'Survivor';
  const detail = (entry) => {
    const project = entry.project;
    const uk = locale() === 'uk';
    const veteran = project.difficulty === 'veteran';
    return `${uk ? (veteran ? 'Ветеран' : 'Стандарт') : veteran ? 'Veteran' : 'Standard'} · ${project.format.endsWith('V1') ? (uk ? 'Класичні правила' : 'Legacy rules') : title()}`;
  };
  const name = (entry) => `${local(entry.project.title)} · ${detail(entry).split(' · ')[0]}`;
  return {
    id,
    editionId: mode.id,
    edition: 'Overflight',
    collection: installed ? 'Custom' : 'Classic',
    automaticContinuation: false,
    entries,
    describe(entry) {
      return {
        id: entry.identity ?? entry.project.id,
        revision: mode.compileProject(entry.project).projectIdentity,
        campaignKey: mode.id,
        campaignTitle: title(),
        name: name(entry),
        levelIndex: entries.indexOf(entry),
        campaignLevelCount: entries.length,
        ...(!installed
          ? {
              canonicalLevelKey: `${mode.id}:${entry.project.id}`,
              globalLevelNumber: entries.indexOf(entry) + 1,
            }
          : {}),
        modes: ['solo'],
        tags: ['FPV', 'Arcade'],
        hook: detail(entry),
      };
    },
    presentation: (entry) => ({
      name: name(entry),
      campaignTitle: title(),
      edition: 'Overflight',
      hook: detail(entry),
    }),
    details: (entry) => ({ challenge: detail(entry), route: mode.text(locale(), 'briefing') }),
    availability(entry) {
      try {
        mode.compileProject(entry.project);
        return { state: 'ready' };
      } catch (error) {
        return { state: 'unavailable', reason: error.message };
      }
    },
    progressState: (entry) => progress(entry) ?? { state: 'new', bestStars: null },
    card: (entry) => ({
      kind: 'overflight',
      width: 320,
      height: 132,
      operation: mode.id,
      project: entry.project,
    }),
    completion: () => null,
    launch,
  };
}

export function paintOverflightMission(context, diagram, paintSprite = () => {}) {
  const project = diagram.project;
  const scaleX = 320 / project.arena.width,
    scaleY = 132 / project.arena.height;
  context.clearRect(0, 0, 320, 132);
  context.fillStyle = '#11251f';
  context.fillRect(0, 0, 320, 132);
  context.strokeStyle = '#2d493b';
  context.lineWidth = 1;
  for (const x of [960, 1920]) {
    context.beginPath();
    context.moveTo(x * scaleX, 0);
    context.lineTo(x * scaleX, 132);
    context.stroke();
  }
  if (diagram.operation === 'overflight-hunt') {
    for (const sector of project.encounters) {
      for (const pack of sector.packs) {
        context.fillStyle = '#718979';
        context.fillRect(pack.x * scaleX - 2, pack.y * scaleY - 2, 4, 4);
      }
      for (const objective of sector.objectives) {
        context.fillStyle = '#f4c765';
        context.fillRect(objective.x * scaleX - 3, objective.y * scaleY - 3, 6, 6);
      }
    }
  } else {
    // Read the first three authored pressure patterns: a schematic of the
    // encounter rhythm, never a claimed map of every future spawn.
    const patterns = project.encounters.filter((entry) => entry.pattern !== 'relief').slice(0, 3);
    context.fillStyle = '#718979';
    for (const [phase, encounter] of patterns.entries()) {
      for (let index = 0; index < 20; index++) {
        let x = 13 + ((index * 23) % 84),
          y = 16 + ((index * 31) % 101);
        if (encounter.pattern === 'crossing') {
          x = 14 + index * 4;
          y = 32 + (index % 2) * 57;
        }
        if (encounter.pattern === 'flank') {
          x = index % 2 ? 15 : 84;
          y = 16 + (index % 10) * 11;
        }
        if (encounter.pattern === 'armored') {
          x = 20 + (index % 4) * 21;
          y = 19 + Math.floor(index / 4) * 24;
        }
        if (encounter.pattern === 'support') {
          x = 53 + Math.cos(index) * (12 + (index % 3) * 8);
          y = 66 + Math.sin(index) * 42;
        }
        context.fillRect(
          phase * 106 + x,
          y,
          encounter.pattern === 'armored' && index % 4 === 0 ? 6 : 3,
          4,
        );
      }
    }
  }
  for (const prop of project.props ?? []) {
    context.fillStyle = '#9aebda';
    context.fillRect(prop.x * scaleX - 3, prop.y * scaleY - 3, 6, 6);
  }
  paintSprite(context, 'drone', 24, 66, 30, 0);
}
