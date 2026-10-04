// Offline glTF-Transform adapter. The runtime/import validator owns the one payload schema.
import {
  WORLD_SURFACE_COATING_EXTENSION as NAME,
  validateWorldSurfaceCoatings,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';

export function surfaceCoatingExtension({ Extension, ExtensionProperty, PropertyType }) {
  class Coating extends ExtensionProperty {
    static EXTENSION_NAME = NAME;
    init() {
      this.extensionName = NAME;
      this.propertyType = 'SurfaceCoating';
      this.parentTypes = [PropertyType.MATERIAL];
    }
  }
  return class SurfaceCoating extends Extension {
    static EXTENSION_NAME = NAME;
    extensionName = NAME;
    read(context) {
      for (const index of validateWorldSurfaceCoatings(context.jsonDoc.json))
        context.materials[index].setExtension(NAME, new Coating(this.document.getGraph()));
      return this;
    }
    write(context) {
      for (const material of this.document.getRoot().listMaterials()) {
        if (!material.getExtension(NAME)) continue;
        const definition = context.jsonDoc.json.materials[context.materialIndexMap.get(material)];
        definition.extensions ??= {};
        definition.extensions[NAME] = { version: 1, kind: 'opaque-finish' };
      }
      return this;
    }
  };
}
