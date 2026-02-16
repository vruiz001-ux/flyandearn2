import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashIP } from '@/lib/utils';
import { EventType } from '@prisma/client';

// POST - Track an event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, path, referrer, sessionId, userId, requestId, metadata } = body;

    // Validate event type
    const validTypes = Object.values(EventType);
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: 'Invalid event type' }, { status: 400 });
    }

    // Get and hash IP for privacy
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0]?.trim() || realIP || '127.0.0.1';
    const ipHash = hashIP(ip);

    // Get user agent
    const userAgent = request.headers.get('user-agent') || undefined;

    // Try to get country from headers (if using Cloudflare or similar)
    const country = request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      undefined;

    // Create event
    await prisma.event.create({
      data: {
        type: type as EventType,
        userId: userId || undefined,
        requestId: requestId || undefined,
        sessionId: sessionId || undefined,
        ipHash,
        userAgent,
        referrer: referrer || undefined,
        path: path || undefined,
        country: country || undefined,
        metadata: metadata || undefined,
      },
    });

    // Update daily stats if it's a pageview
    if (type === 'PAGEVIEW') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.dailyStats.upsert({
        where: { date: today },
        create: {
          date: today,
          totalVisits: 1,
          uniqueVisitors: 1,
          pageviews: 1,
        },
        update: {
          totalVisits: { increment: 1 },
          pageviews: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track API error:', error);
    // Don't fail silently for tracking - just return success to not break the client
    return NextResponse.json({ success: true });
  }
}

// GET - Return tracking script
export async function GET(request: NextRequest) {
  const script = `
(function() {
  var FAE_TRACK = {
    sessionId: null,
    init: function() {
      this.sessionId = this.getSessionId();
      this.trackPageview();
      this.setupSPATracking();
    },
    getSessionId: function() {
      var sid = sessionStorage.getItem('fae_sid');
      if (!sid) {
        sid = 'sid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('fae_sid', sid);
      }
      return sid;
    },
    track: function(type, data) {
      var payload = Object.assign({
        type: type,
        sessionId: this.sessionId,
        path: window.location.pathname,
        referrer: document.referrer
      }, data || {});

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', JSON.stringify(payload));
      } else {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function() {});
      }
    },
    trackPageview: function() {
      this.track('PAGEVIEW');
    },
    setupSPATracking: function() {
      var self = this;
      var pushState = history.pushState;
      history.pushState = function() {
        pushState.apply(history, arguments);
        self.trackPageview();
      };
      window.addEventListener('popstate', function() {
        self.trackPageview();
      });
    }
  };

  if (document.readyState === 'complete') {
    FAE_TRACK.init();
  } else {
    window.addEventListener('load', function() { FAE_TRACK.init(); });
  }

  window.FAE_TRACK = FAE_TRACK;
})();
`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
