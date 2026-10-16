import { setMenuIcon } from '../../ui/native-menu-icons.mjs';

const doc = globalThis.document;
const win = doc.defaultView;
const fixtures = doc.getElementById('fixtures');
for (const [id, label] of [
  ['shell-home', 'Solo / DroneAid'],
  ['race-main', 'Versus'],
  ['coop-menu', 'Team'],
]) {
  const root = doc.createElement('section');
  root.id = id;
  root.className = 'native-landing';
  if (id === 'shell-home') root.dataset.landingIdentity = 'droneaid';
  root.innerHTML = `
    <h2>${label}</h2>
    <div class="game-mode-choice"><button aria-current="page">Solo</button></div>
    <div class="native-menu-actions">
      <button class="primary race-primary field-kit-primary" disabled>Start (disabled)</button>
      <button class="primary race-primary field-kit-primary" aria-disabled="true">Continue (ARIA disabled)</button>
      <button class="primary race-primary field-kit-primary">Start (enabled)</button>
      <button class="controller-focus">Settings (controller focus)</button>
    </div>`;
  setMenuIcon(root.querySelector('[aria-current]'), 'solo');
  for (const button of root.querySelectorAll('.native-menu-actions button')) {
    setMenuIcon(button, button.classList.contains('controller-focus') ? 'settings' : 'play');
  }
  fixtures.append(root);
}
const forcedColors = win.matchMedia('(forced-colors: active)');
const state = (node) => {
  const style = win.getComputedStyle(node);
  const icon = win.getComputedStyle(node, '::before');
  return {
    text: node.textContent,
    disabled: node.disabled || node.getAttribute('aria-disabled') === 'true',
    color: style.color,
    background: style.backgroundColor,
    border: style.borderTopStyle,
    borderColor: style.borderTopColor,
    outline: style.outlineColor,
    iconColor: icon.backgroundColor,
    iconAdjustment: icon.forcedColorAdjust,
    iconMask: icon.maskImage !== 'none',
    height: node.getBoundingClientRect().height,
  };
};
function measure() {
  const hosts = [...fixtures.children].map((root) => ({
    host: root.id,
    controls: [...root.querySelectorAll('button')].map(state),
  }));
  const checks = hosts.flatMap(({ host, controls }) => {
    const selected = controls[0];
    const disabled = controls.filter((control) => control.disabled);
    const enabled = controls.find((control) => control.text === 'Start (enabled)');
    return [
      [
        host + ': disabled remains distinct',
        disabled.every((control) => control.border === 'dashed' && control.color !== enabled.color),
      ],
      [host + ': disabled keeps target', disabled.every((control) => control.height >= 44)],
      [host + ': masks remain present', controls.every((control) => control.iconMask)],
      ...(forcedColors.matches
        ? [
            [
              host + ': icon uses system text color',
              controls.every(
                (control) =>
                  control.iconColor === control.color && control.iconAdjustment === 'none',
              ),
            ],
            [host + ': selection survives shadow removal', selected.border === 'double'],
          ]
        : []),
    ];
  });
  doc.getElementById('result').textContent = JSON.stringify(
    {
      forcedColors: forcedColors.matches,
      passed: checks.every(([, passed]) => passed),
      checks: Object.fromEntries(checks),
      hosts,
    },
    null,
    2,
  );
}
doc.getElementById('measure').addEventListener('click', measure);
forcedColors.addEventListener('change', measure);
measure();
