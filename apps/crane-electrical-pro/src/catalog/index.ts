import { createMemoryCatalog } from '@mh/3d-editor'
import type { CatalogProvider } from '@mh/3d-editor'
import { CATALOG_ITEMS } from './items'

export function createHostCatalog(): CatalogProvider {
  return createMemoryCatalog(CATALOG_ITEMS)
}

export {
  CATALOG_ITEMS,
  EQUIPMENT_ITEMS,
  FIXTURE_ITEMS,
  OVERLAY_ITEMS,
  findCatalogItem
} from './items'
