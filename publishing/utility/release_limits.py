"""Shared byte envelopes for frozen release inspection and upload."""

MIB = 1024**2
DEFAULT_MAX_DISTRIBUTION_MIB = 1024
MAX_DISTRIBUTION_MIB = 2048
MAX_DISTRIBUTION_BYTES = DEFAULT_MAX_DISTRIBUTION_MIB * MIB


def distribution_within_limit(size, limit_mib=DEFAULT_MAX_DISTRIBUTION_MIB):
    return type(size) is int and size >= 0 and 1 <= limit_mib <= MAX_DISTRIBUTION_MIB and size <= limit_mib * MIB
