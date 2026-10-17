/**
 * Optional maintainer tool; tests only read its committed numerical output.
 * Downloaded Betaflight functions (GPL-3.0-or-later) are compiled in a temporary
 * directory, never bundled into the SIM. The independent C reference must not
 * import the JavaScript evaluator. Run with --source-dir to use downloaded tags.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const versions = ['4.5.2', '4.5.5', '2025.12.4', '2025.12.5', '2026.6.2'];
const sourceDirectory = process.argv[process.argv.indexOf('--source-dir') + 1];
const usingDirectory = process.argv.includes('--source-dir');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const sourceUrl = (version) =>
  `https://raw.githubusercontent.com/betaflight/betaflight/${version}/src/main/fc/rc.c`;
function functionSource(source, name) {
  const start = source.search(new RegExp(`(?:static )?(?:int16_t|float) ${name}\\(`));
  if (start < 0) throw new Error(`Missing upstream function ${name}`);
  const opening = source.indexOf('{', start);
  let depth = 1;
  let end = opening + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(start, end);
}
const functions = {
  actual: 'applyActualRates',
  betaflight: 'applyBetaflightRates',
  quick: 'applyQuickRates',
  kiss: 'applyKissRates',
  raceflight: 'applyRaceFlightRates',
};
const cases = Object.entries({
  actual: [
    [7, 67, 0],
    [12, 85, 45],
    [200, 200, 100],
    [120, 40, 70],
  ],
  betaflight: [
    [100, 70, 0],
    [135, 82, 45],
    [255, 100, 100],
    [205, 55, 37],
  ],
  quick: [
    [100, 67, 0],
    [100, 85, 45],
    [255, 200, 100],
    [200, 1, 77],
  ],
  kiss: [
    [100, 70, 0],
    [135, 82, 45],
    [255, 99, 100],
    [1, 0, 0],
  ],
  raceflight: [
    [70, 0, 0],
    [85, 50, 45],
    [200, 255, 100],
    [1, 255, 100],
  ],
}).flatMap(([algorithm, values]) =>
  values.flatMap(([rcRate, rate, expo], index) =>
    (algorithm === 'quick' ? [false, true] : [false]).map((quickRatesRcExpo) => ({
      algorithm,
      axis: { rcRate, rate, expo, limit: index === 1 ? 500 : 1998 },
      quickRatesRcExpo,
    })),
  ),
);
const throttleCases = [
  { mid: 50, expo: 0, hover: 50 },
  { mid: 35, expo: 65, hover: 30 },
  { mid: 0, expo: 100, hover: 0 },
  { mid: 99, expo: 80, hover: 80 },
  { mid: 50, expo: 100, hover: 50 },
];
const prelude = `
#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <math.h>
#define THROTTLE_LOOKUP_LENGTH 12
#define PWM_RANGE 1000
#define PWM_RANGE_MIN 1000
#define PWM_RANGE_MAX 2000
#define SETPOINT_RATE_LIMIT_MIN -1998.0f
#define SETPOINT_RATE_LIMIT_MAX 1998.0f
#define RC_RATE_INCREMENTAL 14.54f
#define MAX(a,b) ((a) > (b) ? (a) : (b))
#define power3(x) ((x)*(x)*(x))
#define power5(x) ((x)*(x)*(x)*(x)*(x))
static float constrainf(float x, float a, float b) {return x<a?a:x>b?b:x;}
static int scaleRange(int x,int a,int b,int c,int d) {return (int)(((long)d-c)*(x-a)/(b-a))+c;}
static float scaleRangef(float x,float a,float b,float c,float d) {return ((d-c)*(x-a)/(b-a))+c;}
typedef struct { uint8_t rcRates[3],rates[3],rcExpo[3],thrMid8,thrExpo8,thrHover8; bool quickRatesRcExpo; } Profile;
static Profile config;
static Profile *currentControlRateProfile=&config;
static int16_t lookupThrottleRC[THROTTLE_LOOKUP_LENGTH];
`;
const directory = await mkdtemp(join(tmpdir(), 'fpv-rate-reference-'));
const fixture = {
  format: 'BetaflightRateReference.v1',
  rateInput: { from: -1000, to: 1000, divisor: 1000 },
  throttleInput: { from: 0, to: 1000, divisor: 1000 },
  sources: [],
  rates: [],
  throttle: [],
};
try {
  for (const version of versions) {
    const source = usingDirectory
      ? await readFile(join(sourceDirectory, `rc-${version}.c`), 'utf8')
      : await (await fetch(sourceUrl(version))).text();
    const isOld = version.startsWith('4.5.');
    const rateCode = Object.values(functions)
      .map((name) => functionSource(source, name))
      .join('\n');
    const init = source.slice(source.indexOf('void initRcProcessing(void)'));
    const initCurve = init.slice(
      init.indexOf('\n', init.indexOf('rcCommandYawDivider')) + 1,
      init.indexOf('    switch (currentControlRateProfile->rates_type)'),
    );
    const throttleCode = `${isOld ? '' : functionSource(source, 'quadraticBezier')}\n${functionSource(source, 'rcLookupThrottle')}\nstatic void initThrottle(void) {\n${initCurve}\n}`;
    const main = [
      'int main(void) {',
      ...cases.map(
        ({ algorithm, axis, quickRatesRcExpo }) =>
          `config.rcRates[0]=${axis.rcRate};config.rates[0]=${axis.rate};config.rcExpo[0]=${axis.expo};config.quickRatesRcExpo=${Number(quickRatesRcExpo)}; for(int i=-1000;i<=1000;i++){float x=(float)i/1000.0f;printf("%.9g\\n",constrainf(${functions[algorithm]}(0,x,fabsf(x)),-${axis.limit}.0f,${axis.limit}.0f));}`,
      ),
      ...throttleCases.map(
        ({ mid, expo, hover }) =>
          `config.thrMid8=${mid};config.thrExpo8=${expo};config.thrHover8=${hover};initThrottle();for(int i=0;i<=1000;i++)printf("%d\\n",rcLookupThrottle(i)-1000);`,
      ),
      'return 0;}',
    ].join('\n');
    const file = join(directory, `${version}.c`);
    const binary = join(directory, version);
    await writeFile(file, prelude + rateCode + '\n' + throttleCode + '\n' + main);
    execFileSync(process.env.CC || 'cc', [
      '-std=c11',
      '-O0',
      '-ffp-contract=off',
      file,
      '-lm',
      '-o',
      binary,
    ]);
    const output = execFileSync(binary, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
      .trim()
      .split('\n')
      .map(Number);
    const rates = cases.map((value, i) => ({
      ...value,
      expected: output.slice(i * 2001, (i + 1) * 2001),
    }));
    const throttle = throttleCases.map((value, i) => ({
      ...value,
      expected: output.slice(cases.length * 2001 + i * 1001, cases.length * 2001 + (i + 1) * 1001),
    }));
    if (!fixture.rates.length) fixture.rates = rates;
    else if (JSON.stringify(fixture.rates) !== JSON.stringify(rates))
      throw new Error(`Rate equivalence failed for ${version}`);
    const model = isOld ? 'betaflight-4.5' : 'betaflight-2025.12';
    const previous = fixture.throttle.find((item) => item.model === model);
    if (previous && JSON.stringify(previous.cases) !== JSON.stringify(throttle))
      throw new Error(`Throttle equivalence failed for ${version}`);
    if (!previous) fixture.throttle.push({ model, cases: throttle });
    fixture.sources.push({
      version,
      url: sourceUrl(version),
      sha256: sha256(source),
      rateFunctionsSha256: sha256(rateCode),
      throttleFunctionsSha256: sha256(throttleCode),
      model,
    });
  }
  await writeFile(
    new URL('../game/test/fixtures/fpv-betaflight-rates.json', import.meta.url),
    `${JSON.stringify(fixture)}\n`,
  );
  console.log(
    `Generated ${fixture.rates.length * 2001} independent rate samples and ${fixture.throttle.reduce((count, group) => count + group.cases.length * 1001, 0)} throttle samples for ${versions.join(', ')}.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
