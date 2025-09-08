import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout 
      tree={source.pageTree} 
      {...baseOptions()}
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg mb-4">
            <div className="flex items-center space-x-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-semibold">Gryt Voice Chat</span>
            </div>
            <p className="text-sm opacity-90 mt-1">
              Modern WebRTC voice communication platform
            </p>
          </div>
        ),
      }}
      toc={{
        enabled: true,
        title: 'On this page',
      }}
    >
      {children}
    </DocsLayout>
  );
}
