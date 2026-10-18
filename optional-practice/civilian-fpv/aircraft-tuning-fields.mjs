/** Shared SI-unit controls for practice and the setup workbench. */
export function aircraftTuningFields() {
  const numericFields = [
    ['aircraft.mass', 'Mass (kg)', 'Маса (кг)', 0.01, 10],
    [
      'aircraft.armLength',
      'Motor distance from centre (m)',
      'Відстань мотора від центра (м)',
      0.01,
      1,
    ],
    ['aircraft.radius', 'Collision radius (m)', 'Радіус зіткнення (м)', 0.01, 1],
    [
      'aircraft.maxThrust',
      'Thrust per motor at nominal voltage (N)',
      'Тяга мотора за номінальної напруги (Н)',
      0.01,
      100,
    ],
    [
      'aircraft.reactionTorque',
      'Reaction torque / thrust (m)',
      'Реактивний момент / тяга (м)',
      0.001,
      1,
    ],
    ['aircraft.motorTimeConstant', 'Motor response time (s)', 'Час реакції мотора (с)', 0.001, 1],
    [
      'aircraft.motorOutputLimit',
      'Motor output limit (0–1)',
      'Обмеження потужності моторів (0–1)',
      0.1,
      1,
    ],
    ['aircraft.linearDrag', 'Linear drag (N·s/m)', 'Лінійний опір (Н·с/м)', 0, 10],
    ['aircraft.quadraticDrag', 'Quadratic drag (N·s²/m²)', 'Квадратичний опір (Н·с²/м²)', 0, 10],
    ['aircraft.angularDrag', 'Angular drag (N·m·s/rad)', 'Кутовий опір (Н·м·с/рад)', 0, 10],
    [
      'aircraft.sensorNoise',
      'Gyro noise amplitude (rad/s)',
      'Амплітуда шуму гіроскопа (рад/с)',
      0,
      5,
    ],
    [
      'aircraft.vibration',
      'Gyro vibration amplitude (rad/s)',
      'Амплітуда вібрації гіроскопа (рад/с)',
      0,
      5,
    ],
    [
      'aircraft.battery.nominalVoltage',
      'Nominal battery voltage (V)',
      'Номінальна напруга батареї (В)',
      1,
      100,
    ],
    [
      'aircraft.battery.fullVoltage',
      'Full battery voltage (V)',
      'Напруга зарядженої батареї (В)',
      1,
      100,
    ],
    [
      'aircraft.battery.emptyVoltage',
      'Empty battery voltage (V)',
      'Напруга розрядженої батареї (В)',
      1,
      100,
    ],
    ['aircraft.battery.resistance', 'Battery resistance (Ω)', 'Опір батареї (Ω)', 0, 10],
    [
      'aircraft.battery.fullCurrent',
      'Full motor current (A)',
      'Струм моторів на повній потужності (А)',
      0,
      1000,
    ],
    ['aircraft.battery.capacityAh', 'Battery capacity (Ah)', 'Ємність батареї (А·год)', 0.01, 100],
    [
      'controller.gyroFilterHz',
      'Gyro low-pass cutoff (Hz; 0 off)',
      'Частота фільтра гіроскопа (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.dTermFilterHz',
      'D-term low-pass cutoff (Hz; 0 off)',
      'Частота фільтра D (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.inputSmoothingHz',
      'Input smoothing cutoff (Hz; 0 off)',
      'Частота згладжування входу (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.feedforwardFilterHz',
      'Feedforward low-pass cutoff (Hz; 0 off)',
      'Частота фільтра випередження (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.integralLimit',
      'Integral torque limit (N·m)',
      'Обмеження інтегрального моменту (Н·м)',
      0,
      1,
    ],
    [
      'controller.antiWindup',
      'Anti-windup recovery (1/s)',
      'Відновлення інтегратора (1/с)',
      0,
      100,
    ],
  ];
  for (const [axis, labelEn, labelUk] of [
    ['x', 'Pitch', 'Тангаж'],
    ['y', 'Yaw', 'Рискання'],
    ['z', 'Roll', 'Крен'],
  ])
    numericFields.push([
      `aircraft.inertia.${axis}`,
      `${labelEn} inertia (kg·m²)`,
      `Інерція: ${labelUk} (кг·м²)`,
      0.000001,
      10,
    ]);
  for (const axis of ['roll', 'pitch', 'yaw'])
    for (const [key, unit] of [
      ['p', 'N·m/(rad/s)'],
      ['i', 'N·m/rad'],
      ['d', 'N·m/(rad/s²)'],
      ['feedforward', 'N·m/(rad/s²)'],
    ])
      numericFields.push([
        `controller.gains.${axis}.${key}`,
        `${{ roll: 'Roll', pitch: 'Pitch', yaw: 'Yaw' }[axis]} ${key.toUpperCase()} (${unit})`,
        `${{ roll: 'Крен', pitch: 'Тангаж', yaw: 'Рискання' }[axis]} ${key.toUpperCase()} (${unit})`,
        0,
        1,
      ]);
  for (const axis of ['x', 'y', 'z']) {
    for (const [kind, unit] of [
      ['linear', 'N·s/m'],
      ['quadratic', 'N·s²/m²'],
      ['angular', 'N·m·s/rad'],
    ])
      numericFields.push([
        `aircraft.drag.${kind}.${axis}`,
        `${kind} drag ${axis} (${unit})`,
        `Опір ${kind} ${axis} (${unit})`,
        0,
        100,
      ]);
    numericFields.push([
      `aircraft.geometry.bodyHalfExtents.${axis}`,
      `Body half-size ${axis} (m)`,
      `Піврозмір корпуса ${axis} (м)`,
      0.001,
      2,
    ]);
  }
  numericFields.push(
    [
      'aircraft.propulsion.idleSpeed',
      'Armed idle motor speed',
      'Швидкість моторів на холостому ході',
      0,
      0.3,
    ],
    [
      'aircraft.battery.currentLimit',
      'Battery current limit (A)',
      'Обмеження струму батареї (А)',
      0.01,
      1000,
    ],
  );
  return numericFields;
}
