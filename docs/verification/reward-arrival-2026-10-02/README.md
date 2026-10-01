# Reward arrival qualification

## Behavior

- Normal solo and creator wins retain the original board for 2.4 seconds while
  the final cover dissolves and confetti blooms. The creator menu no longer
  appears above the board at completion.
- The image expands gently into the earned view; optional video starts after
  3.8 seconds with its exact poster retained underneath the dissolve. Reduced
  effects keep the hold, suppress movement and leave video playback explicit.
- Demo uses the same renderer and expansion. Earned video playback requires an
  exact story receipt matching the displayed earned picture. Hide pictures and
  unearned/reduced media never trigger video preparation. Pause, hiding media,
  leaving and source replacement retire pending preparation. Demo does not award.

## Browser

Real Start mission → ArrowDown wins of the supplied Social Drone · Sky Watch
sample were used. DOM observations confirmed the board stays inside the viewport,
the creator menu remains hidden, and no video element exists during the board
hold or initial expanded-image view. Subsequent playback reported playing while
the exact poster stayed underneath; the ending returned to that poster.

- `board-reveal.png`: the final cover dissolving on the unchanged board.
- `image-arrival.png`: image arrival before video creation.
- `video-dissolve.png`: actual video playback after the hold.
- `phone-image-arrival.png`: phone view before Continue cancels pending playback.

The ordinary game/demo browser route requests a password in this browser; its
visual check remains unavailable without that password. Demo behavior is covered
by the real mounted-host/simulation tests plus targeted media-lifecycle tests.
No physical-device qualification or full static rebuild is claimed for this turn.

## Automated checks

156 focused tests passed across reward timing/geometry, cinematic playback,
creator menus/media, persistent wins, confetti, demo source rotation, earned and
concealed media, Journey pictures, retention and boot packaging (combined runs).
Changed-file ESLint and Prettier, localization check and whitespace check passed.

Two old demo tests counted re-downloads of one replay instead of scene adoption;
they now inspect the selected level, allowing the director's normal rotation to
another source. A Journey fixture's stray bestStars property was removed to match
the existing strict receipt schema. The unchanged HEAD baseline reproduced that
fixture failure and eight unrelated failures in `boot.test.mjs` after the earlier
access-gate changes; those eight boot behavior failures remain outside this change.
