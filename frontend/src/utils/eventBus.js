const listeners = new Map()

export const eventBus = {
  on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set())
    }
    listeners.get(event).add(callback)
    return () => {
      listeners.get(event)?.delete(callback)
    }
  },

  off(event, callback) {
    listeners.get(event)?.delete(callback)
  },

  emit(event, payload) {
    listeners.get(event)?.forEach((callback) => callback(payload))
  }
}

export const EVENTS = {
  INVENTORY_UPDATED: 'inventory:updated'
}
