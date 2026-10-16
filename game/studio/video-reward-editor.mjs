import { createMediaRewardEditor } from './media-reward-editor.mjs';
import {
  inspectDiscoveryVideoHandoff,
  editDiscoveryVideoHandoff,
} from '../content-design/discovery-video-handoff.mjs';

export function createVideoRewardEditor({ openSource, ...options }) {
  return createMediaRewardEditor({
    ...options,
    kind: 'video',
    roles: {
      video: '.mp4,.webm,video/mp4,video/webm',
      poster: '.png,.jpg,.jpeg,.webp',
      en: '.txt,text/plain',
      uk: '.txt,text/plain',
      enCaptions: '.vtt,text/vtt',
      ukCaptions: '.vtt,text/vtt',
    },
    inspect: (context, files, config) =>
      inspectDiscoveryVideoHandoff(context, files, {
        ...config,
        ...(openSource ? { openSource } : {}),
      }),
    edit: editDiscoveryVideoHandoff,
  });
}
