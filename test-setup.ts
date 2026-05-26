import { JSDOM } from "jsdom"

const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
    resources: "usable",
})

global.document = dom.window.document
global.window = dom.window as unknown as Window & typeof globalThis
global.navigator = dom.window.navigator
global.Element = dom.window.Element
global.HTMLElement = dom.window.HTMLElement
global.HTMLElement.prototype.scrollIntoView = function () {
    return null
}

global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 0) as unknown as number
}
global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id)
}

// Ensure Resend SDK doesn't throw at import time
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test_dummy_key"