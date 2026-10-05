import { mountContentStudioLinks, openContentStudioSection } from './content-studio-navigation.mjs';

mountContentStudioLinks({ document, href: window.location.href });
openContentStudioSection({ document, href: window.location.href });
