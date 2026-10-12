import React from 'react';

/**
 * Catches render/runtime crashes (including Base44 "Domain is not valid")
 * and always shows a playable landing-style screen instead of a black page.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    const message = String(error?.message || error || 'Something went wrong');
    return { hasError: true, message };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDomain = /domain is not valid/i.test(this.state.message);

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: '#0c4a30' }}
      >
        <img
          src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2724130c5_file_00000000f0cc81f689edd7e643506d5b-removebg-preview.png"
          alt="ICECREAMET"
          className="h-20 w-auto object-contain mb-4"
        />
        <h1 className="text-4xl font-display text-white mb-2">ICECREAMET</h1>
        <p className="text-white/80 max-w-md mb-6">
          {isDomain
            ? 'This mirror is loading. Use the official site to play with your account.'
            : 'Something went wrong loading the game UI. You can still open the home page.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/"
            className="px-6 py-3 rounded-full font-display text-[#0c4a30]"
            style={{ backgroundColor: '#93d4ad' }}
            onClick={(e) => {
              e.preventDefault();
              this.setState({ hasError: false, message: '' });
              window.location.href = '/';
            }}
          >
            Reload home
          </a>
          <a
            href="https://icecreametisnot.base44.app/"
            className="px-6 py-3 rounded-full font-display bg-white text-[#0c4a30]"
          >
            Play on official site
          </a>
        </div>
        {!isDomain && this.state.message && (
          <p className="mt-6 text-xs text-white/40 max-w-sm break-words">{this.state.message}</p>
        )}
      </div>
    );
  }
}
