export function invalidateMapSize(map: { invalidateSize: (options?: { animate?: boolean }) => void }) {
    map.invalidateSize({ animate: false })
}
