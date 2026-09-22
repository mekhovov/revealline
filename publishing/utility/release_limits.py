"""Shared byte envelopes for frozen release inspection and upload."""

MIB = 1024**2
DEFAULT_MAX_DISTRIBUTION_MIB = 1024
MAX_DISTRIBUTION_MIB = 2048
MAX_DISTRIBUTION_BYTES = 950_000_000


def distribution_within_limit(
    size,
    limit_mib=DEFAULT_MAX_DISTRIBUTION_MIB,
    limit_bytes=None,
):
    if type(size) is not int or size < 0:
        return False
    if limit_bytes is not None:
        return type(limit_bytes) is int and 1 <= limit_bytes <= MAX_DISTRIBUTION_MIB * MIB and size <= limit_bytes
    return 1 <= limit_mib <= MAX_DISTRIBUTION_MIB and size <= limit_mib * MIB
