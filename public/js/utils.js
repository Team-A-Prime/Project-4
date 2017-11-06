/**
 * A convienience method for selecting HTML elements
 * @param {string} input - String: An element query selector
 * @return {(NodeList|Node)} A list of matching nodes or only one Node
 */
let $ = input => {
  let elements = document.querySelectorAll(input)
  if (elements.length > 1) return Array.from(elements)
  return elements[0]
}
