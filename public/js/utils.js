let $ = s => {
  let elements = document.querySelectorAll(s)
  if (elements.length > 1) return Array.from(elements)
  return elements[0]
}
