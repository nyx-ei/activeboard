import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ActiveBoard';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background:
            'linear-gradient(180deg, rgba(7,11,24,1) 0%, rgba(12,20,37,1) 100%)',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              background: '#22c55e',
              color: '#ffffff',
            }}
          >
            AB
          </div>
          <span>ActiveBoard</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 860 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              padding: '14px 24px',
              fontSize: 28,
              color: '#cbd5e1',
            }}
          >
            Trusted by study groups preparing for MCCQE1, USMLE and PLAB
          </div>

          <div style={{ fontSize: 78, lineHeight: 1.02, fontWeight: 800 }}>
            Stop hiding behind the noise of your study group.
          </div>

          <div style={{ fontSize: 34, lineHeight: 1.35, color: '#94a3b8' }}>
            ActiveBoard brings an exam simulator directly into your Zoom or Teams study sessions.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, fontSize: 28, color: '#d1fae5' }}>
          <span>Test yourself solo</span>
          <span>•</span>
          <span>Measure your certainty</span>
          <span>•</span>
          <span>Make your consistency visible</span>
        </div>
      </div>
    ),
    size,
  );
}
