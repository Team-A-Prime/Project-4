/**
 * A lightweight JQuery-like shim
 * @param {string} input - String: An element query selector
 * @return {(NodeList|Node)} A list of matching nodes or only one Node
 */
let $ = s => {
  let elements = document.querySelectorAll(s)
  if (elements.length > 1) return Array.from(elements)
  return elements[0]
}
