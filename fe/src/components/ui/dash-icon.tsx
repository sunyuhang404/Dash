import { defineComponent, type PropType } from 'vue';

export type DashIconName =
  | 'branch'
  | 'chevron'
  | 'close'
  | 'commit'
  | 'fetch'
  | 'filter'
  | 'folder'
  | 'history'
  | 'merge'
  | 'more'
  | 'plus'
  | 'pull'
  | 'push'
  | 'search'
  | 'settings'
  | 'sidebarCollapse'
  | 'sidebarExpand'
  | 'stash'
  | 'status'
  | 'tag'
  | 'undo'
  | 'workspace';

const renderPath = (name: DashIconName) => {
  switch (name) {
    case 'branch':
      return (
        <>
          <path d="M6 3.5v9a3 3 0 0 0 3 3h2" />
          <path d="M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM13 15.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 3.5v4a3 3 0 0 1-3 3H9" />
          <path d="M14 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </>
      );
    case 'chevron':
      return <path d="m7 4 5 5-5 5" />;
    case 'close':
      return <path d="m5 5 8 8m0-8-8 8" />;
    case 'commit':
      return (
        <>
          <path d="M3 9h4m4 0h4" />
          <circle cx="9" cy="9" r="3" />
        </>
      );
    case 'fetch':
      return (
        <>
          <path d="M9 3a6 6 0 1 0 5.2 3" />
          <path d="M14 2v4h-4" />
        </>
      );
    case 'filter':
      return (
        <>
          <path d="M3 5h5m3 0h4M3 9h9m3 0h0M3 13h3m3 0h6" />
          <circle cx="9.5" cy="5" r="1.25" />
          <circle cx="13.5" cy="9" r="1.25" />
          <circle cx="7.5" cy="13" r="1.25" />
        </>
      );
    case 'folder':
      return <path d="M2.5 5.5h5l1.5 2H15.5v7H2.5z" />;
    case 'history':
      return (
        <>
          <circle cx="9" cy="9" r="6" />
          <path d="M9 5.5V9l2.5 1.5" />
        </>
      );
    case 'merge':
      return (
        <>
          <path d="M5 3.5v8a3 3 0 0 0 3 3h3" />
          <path d="M13 3.5v4a3 3 0 0 1-3 3H8" />
          <circle cx="5" cy="3.5" r="1.5" />
          <circle cx="13" cy="3.5" r="1.5" />
          <circle cx="13" cy="14.5" r="1.5" />
        </>
      );
    case 'more':
      return (
        <>
          <circle cx="4.5" cy="9" r="1" fill="currentColor" stroke="none" />
          <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="9" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case 'plus':
      return <path d="M9 3v12M3 9h12" />;
    case 'pull':
      return (
        <>
          <path d="M9 3v9" />
          <path d="m5.5 8.5 3.5 3.5 3.5-3.5" />
          <path d="M3 15h12" />
        </>
      );
    case 'push':
      return (
        <>
          <path d="M9 15V6" />
          <path d="M5.5 9.5 9 6l3.5 3.5" />
          <path d="M3 3h12" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="7.5" cy="7.5" r="4" />
          <path d="m10.5 10.5 4 4" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="9" cy="9" r="2.5" />
          <path d="M9 2.5v2m0 9v2M15.5 9h-2m-9 0h-2M13.6 4.4 12.2 5.8m-6.4 6.4-1.4 1.4m9.2 0-1.4-1.4M5.8 5.8 4.4 4.4" />
        </>
      );
    case 'sidebarCollapse':
      return (
        <>
          <rect x="2.5" y="3" width="13" height="12" rx="2" />
          <path d="M6.5 3v12" />
          <path d="m12 6-3 3 3 3" />
        </>
      );
    case 'sidebarExpand':
      return (
        <>
          <rect x="2.5" y="3" width="13" height="12" rx="2" />
          <path d="M6.5 3v12" />
          <path d="m9.5 6 3 3-3 3" />
        </>
      );
    case 'stash':
      return (
        <>
          <path d="M4 6h10v8H4z" />
          <path d="M3 6h12l-2-3H5z" />
          <path d="M7 9h4" />
        </>
      );
    case 'status':
      return (
        <>
          <circle cx="9" cy="9" r="6" />
          <path d="M9 5.5v4h3" />
        </>
      );
    case 'tag':
      return (
        <>
          <path d="M3 4h6l6 6-5 5-7-7z" />
          <circle cx="6.5" cy="6.5" r="1" />
        </>
      );
    case 'undo':
      return (
        <>
          <path d="M6.5 5 3 8.5 6.5 12" />
          <path d="M3.5 8.5h7a4 4 0 0 1 0 8" />
        </>
      );
    case 'workspace':
      return (
        <>
          <rect x="3" y="3" width="12" height="12" rx="2" />
          <path d="M6 11 8 8l2 2 2-3" />
        </>
      );
  }
};

export const DashIcon = defineComponent({
  name: 'DashIcon',
  props: {
    name: {
      type: String as PropType<DashIconName>,
      required: true,
    },
  },
  setup: (props) => {
    return () => (
      <svg
        class="dash-icon size-4 shrink-0"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {renderPath(props.name)}
      </svg>
    );
  },
});
