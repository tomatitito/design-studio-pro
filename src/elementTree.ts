import type { Element } from "./types";

export function findElementById(elements: Element[], id: string): Element | null {
  for (const element of elements) {
    if (element.id === id) return element;
    if (element.elementType === "group") {
      const child = findElementById(element.children, id);
      if (child) return child;
    }
  }

  return null;
}

export function updateElementById(
  elements: Element[],
  id: string,
  updater: (element: Element) => Element,
): { elements: Element[]; updated: boolean } {
  let didUpdate = false;

  const nextElements = elements.map((element) => {
    if (element.id === id) {
      didUpdate = true;
      return updater(element);
    }

    if (element.elementType !== "group") {
      return element;
    }

    const childResult = updateElementById(element.children, id, updater);
    if (!childResult.updated) {
      return element;
    }

    didUpdate = true;
    return {
      ...element,
      children: childResult.elements,
    };
  });

  return { elements: didUpdate ? nextElements : elements, updated: didUpdate };
}
