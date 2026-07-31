export function setMarkup(node, markup) {
  node.innerHTML = markup;
}

export function find(node, selector) {
  return node.querySelector(selector);
}

export function findAll(node, selector) {
  return [...node.querySelectorAll(selector)];
}

export function listen(node, event, handler) {
  node.addEventListener(event, handler);
}

export function setText(node, value) {
  node.textContent = value ?? "";
}

export function downloadFile(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
