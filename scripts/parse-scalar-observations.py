"""Read-only bounded diagnostic parser. It does not execute the World fixture."""
import json

PREFIX = 'world-fixture-memory '
FIELDS = {'sequence', 'phase', 'fixtureId', 'created', 'disposeStarted',
          'disposeCompleted', 'omitted', 'heapUsed', 'heapTotal', 'external',
          'arrayBuffers', 'rss', 'liveWorkers', 'terminatedWorkers', 'retainedMessages'}
PHASES = ('constructed', 'before-dispose', 'after-dispose', 'after-worker-prune')
WORKERS = ('liveWorkers', 'terminatedWorkers', 'retainedMessages')
BACKSLASH = chr(92)


def escape_node_tap_scalar_line(value):
    # Registered scalar records are single-line ASCII without control characters.
    # This is tap.js 22.22.2's backslash/hash escaping on that exact domain.
    if any(ord(c) < 32 or ord(c) > 126 for c in value):
        raise ValueError('Only the emitter single-line ASCII domain is supported')
    return value.replace(BACKSLASH, BACKSLASH + BACKSLASH).replace('#', BACKSLASH + '#')


def decode_node_tap_scalar_line(value):
    result, i = [], 0
    while i < len(value):
        c = value[i]
        if c == BACKSLASH:
            i += 1
            if i == len(value) or value[i] not in (BACKSLASH, '#'):
                raise ValueError('Unknown or truncated Node TAP escape')
            c = value[i]
        result.append(c)
        i += 1
    text = ''.join(result)
    if escape_node_tap_scalar_line(text) != value:
        raise ValueError('Noncanonical Node TAP scalar wrapper')
    return text


def integer(value, minimum=0):
    return type(value) is int and minimum <= value <= 2 ** 53 - 1


def parse_observations(raw, require_complete=False):
    if not isinstance(raw, bytes) or len(raw) > 4 * 1024 * 1024:
        raise ValueError('Raw stream bound/type')
    rows, wrappers, fixtures = [], set(), {}
    last_counters = (0, 0, 0)
    observed_counts = [0, 0, 0]
    for line in raw.decode('utf-8', errors='strict').splitlines():
        text = line.lstrip(' \t')
        if text.startswith('# ' + PREFIX):
            payload, framing = text[2:], 'direct'
        elif text.startswith('# ' + BACKSLASH + '# ' + PREFIX):
            decoded = decode_node_tap_scalar_line(text[2:])
            if not decoded.startswith('# ' + PREFIX):
                raise ValueError('Decoded stdout is not the registered emitter line')
            payload, framing = decoded[2:], 'node-tap-escaped-stdout'
        else:
            if PREFIX in line:
                raise ValueError('Unsupported or embedded observation framing')
            continue
        if len(('# ' + payload + '\n').encode()) > 1024 or len(rows) >= 512:
            raise ValueError('Observation line/count bound')
        row = json.loads(payload[len(PREFIX):])
        if not isinstance(row, dict) or set(row) != FIELDS:
            raise ValueError('Observation schema')
        if row['phase'] not in PHASES:
            raise ValueError('Observation phase')
        for key in FIELDS - {'phase', *WORKERS}:
            if not integer(row[key]):
                raise ValueError('Noninteger scalar: ' + key)
        if row['sequence'] != len(rows) + 1 or not integer(row['fixtureId'], 1):
            raise ValueError('Observation sequence/fixture identity')
        if row['omitted'] != 0:
            raise ValueError('Diagnostic observations were omitted')
        if row['heapUsed'] > row['heapTotal']:
            raise ValueError('Inconsistent memory sample')
        counters = tuple(row[k] for k in ('created', 'disposeStarted', 'disposeCompleted'))
        if not counters[0] >= counters[1] >= counters[2] or row['fixtureId'] > counters[0]:
            raise ValueError('Fixture/disposal counter relation')
        if any(a < b for a, b in zip(counters, last_counters)):
            raise ValueError('Fixture/disposal counter moved backward')
        if row['phase'] in PHASES[:3]:
            observed_counts[PHASES.index(row['phase'])] += 1
        if tuple(observed_counts) != counters:
            raise ValueError('Counters differ from observed lifecycle phases')
        if row['phase'] == 'constructed' and row['fixtureId'] != observed_counts[0]:
            raise ValueError('Construction fixture identity is not sequential')
        if row['phase'] == 'constructed':
            if any(row[k] is not None for k in WORKERS):
                raise ValueError('Construction must not inspect later worker class')
        elif any(not integer(row[k]) for k in WORKERS):
            raise ValueError('Cleanup worker counts must be integers')
        phases = fixtures.setdefault(row['fixtureId'], [])
        if len(phases) >= 4 or row['phase'] != PHASES[len(phases)]:
            raise ValueError('Per-fixture phase order/duplicate')
        phases.append(row['phase'])
        rows.append(row)
        wrappers.add(framing)
        last_counters = counters
    if not rows:
        raise ValueError('No observations; framing unverified')
    if len(rows) >= 512:
        raise ValueError('Observation cap reached; completeness unknown')
    complete = (all(tuple(v) == PHASES for v in fixtures.values()) and
                set(fixtures) == set(range(1, last_counters[0] + 1)) and
                last_counters[0] == last_counters[1] == last_counters[2])
    if require_complete and not complete:
        raise ValueError('Incomplete fixture lifecycle observations')
    return {'status': 'scalar-observations-complete' if complete else 'scalar-observations-partial',
            'rows': rows, 'observedTAPFramings': sorted(wrappers),
            'fixtureCount': len(fixtures), 'noOmittedRows': True,
            'qualification': 'Diagnostic scalars only; full TAP/footer/115 cases and native guards are separate mandatory evidence.'}
