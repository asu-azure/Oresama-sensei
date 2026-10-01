<script lang="ts" module>
  // Line icons, 24×24, drawn with currentColor. Inline so no icon font or
  // package ships; add a path here when a new one is needed.
  const PATHS = {
    speak: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
    x: "M6 6l12 12M18 6 6 18",
    send: "M4.5 12h13M12.5 6.5 18 12l-5.5 5.5",
    check: "M5 12.5 10 17.5 19 7",
    pencil: "M15.5 4.5l4 4L9 19H5v-4L15.5 4.5Z",
    image: "M4 5.5h16v13H4zM4 15l4.5-4.5 4 4 2.5-2.5 5 5M15 9.5h.01",
    upload: "M12 15.5V5M7.5 9.5 12 5l4.5 4.5M5 15v4h14v-4",
    search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20",
    trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
    archive: "M4 5h16v4H4zM5.5 9v10h13V9M10 13h4",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.5h.01",
    chevron: "M6 9.5l6 6 6-6",
    sparkle: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9L12 3.5ZM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z",
    message: "M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z",
    back: "M19 12H5.5M11 6.5 5.5 12l5.5 5.5",
    replay: "M5 12a7 7 0 1 0 2.1-5M5 4.5V8h3.5",
    eraser: "M9 19h10M5.5 15.5l9-9a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L11 18.5H8.5l-3-3Z",
    plus: "M12 5v14M5 12h14",
    bookmark: "M7 4.5h10v15l-5-3.5-5 3.5z",
    link: "M9.5 14.5l5-5M10.5 6.5l1.5-1.5a3.5 3.5 0 0 1 5 5l-1.5 1.5M13.5 17.5 12 19a3.5 3.5 0 0 1-5-5l1.5-1.5",
    keyboard: "M3.5 7h17v10h-17zM7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 14h8",
    forward: "M5 6l7 6-7 6M12 6l7 6-7 6",
    grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = '1.1em', label }: { name: IconName; size?: string; label?: string } = $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  ><path d={PATHS[name]} /></svg
>
