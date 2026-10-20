"""Shared exclusive restore-directory guards."""
from pack import safe_relative


def mkdir_safe(root, relative):
    current = root
    for name in safe_relative(relative).parts:
        current /= name
        if current.is_symlink():
            raise ValueError('Refusing a symlink as a restore parent')
        if current.exists():
            if not current.is_dir():
                raise ValueError('Restore parent is not a directory')
        else:
            current.mkdir()
    return current


def real_directory(path):
    absolute = path.absolute()
    for parent in [*absolute.parents, absolute]:
        if parent.is_symlink():
            raise ValueError('Directory path includes a symlink')
    return absolute
