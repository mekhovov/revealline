import { createMediaRewardEditor } from './media-reward-editor.mjs';
import {
  inspectDiscoveryAudioHandoff,
  editDiscoveryAudioHandoff,
} from '../content-design/discovery-audio-handoff.mjs';

export function createAudioRewardEditor(options) {
  return createMediaRewardEditor({
    ...options,
    kind: 'audio',
    roles: { audio: '.mp3,audio/mpeg', en: '.txt,text/plain', uk: '.txt,text/plain' },
    inspect: inspectDiscoveryAudioHandoff,
    edit: editDiscoveryAudioHandoff,
  });
}
