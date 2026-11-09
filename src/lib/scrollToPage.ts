/** 让主视图滚动到指定页 */
export function scrollToPage(pageId: string) {
  document
    .querySelector(`.viewer [data-page-id="${pageId}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
