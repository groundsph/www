import { JSDOM } from "jsdom"

const dom = new JSDOM("<html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
    resources: "usable",
})

global.document = dom.window.document
global.window = dom.window as unknown as Window & typeof globalThis
global.navigator = dom.window.navigator
