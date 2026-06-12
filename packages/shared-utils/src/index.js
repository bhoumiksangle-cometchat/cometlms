export const formatDate = (date) => {
    return date.toISOString();
};
export const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
export const generateSlug = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
};
export const truncate = (text, length) => {
    if (text.length <= length)
        return text;
    return text.slice(0, length) + '...';
};
export * from './validation';
//# sourceMappingURL=index.js.map