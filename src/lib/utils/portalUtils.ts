// src/lib/utils/portalUtils.ts

// Portal action for rendering elements outside component tree
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
  };
}