import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BackArrowIcon } from '../components/Icons';

export function PrivacyPage() {
  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link to="/" className="btn btn-ghost mb-lg" style={{ display: 'inline-flex' }}>
            <BackArrowIcon size={18} />
            Back
          </Link>

          <h1 className="mb-lg">Privacy Policy</h1>
          
          <div className="card">
            <p className="text-muted text-sm mb-lg">Last updated: December 2024</p>

            <h3 className="text-accent mb-sm">What TidePool Does</h3>
            <p className="text-secondary mb-xl">
              TidePool is a collaborative playlist app that lets groups build Tidal playlists together. 
              The host connects their Tidal account, and friends can add songs to the shared playlist.
            </p>

            <h3 className="text-accent mb-sm">Information We Collect</h3>
            <div className="text-secondary mb-xl">
              <p className="mb-sm"><strong>From Hosts (Tidal Account Holders):</strong></p>
              <p className="mb-sm">• Tidal OAuth tokens (to manage playlists on your behalf)</p>
              <p className="mb-md">• Your Tidal username and country code</p>
              
              <p className="mb-sm"><strong>From All Users:</strong></p>
              <p className="mb-sm">• Display name you choose when joining a session</p>
              <p>• Basic analytics (page views, via Vercel Analytics)</p>
            </div>

            <h3 className="text-accent mb-sm">How We Use Your Information</h3>
            <div className="text-secondary mb-xl">
              <p className="mb-sm">• Tidal tokens are used solely to create, read, and modify playlists</p>
              <p className="mb-sm">• Display names appear in the participant list and playlist descriptions</p>
              <p>• Analytics help us understand how the app is used</p>
            </div>

            <h3 className="text-accent mb-sm">Data Storage</h3>
            <div className="text-secondary mb-xl">
              <p className="mb-sm">• <strong>Browser:</strong> Theme preference and last playlist ID in localStorage</p>
              <p className="mb-sm">• <strong>Server:</strong> Session data held in memory during active sessions</p>
              <p className="mb-md">• <strong>No Database:</strong> We don't permanently store your data</p>
              <p>When you close your session or the server restarts, session data is cleared.</p>
            </div>

            <h3 className="text-accent mb-sm">Third-Party Services</h3>
            <div className="text-secondary mb-xl">
              <p className="mb-sm">• <strong>Tidal:</strong> We use Tidal's API via OAuth. See <a href="https://tidal.com/privacy" target="_blank" rel="noopener noreferrer">Tidal's Privacy Policy</a></p>
              <p>• <strong>Vercel:</strong> Hosts our app and provides analytics. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel's Privacy Policy</a></p>
            </div>

            <h3 className="text-accent mb-sm">Cookies</h3>
            <p className="text-secondary mb-xl">
              We use a single cookie (<span className="text-mono">tidepool_host</span>) to maintain your 
              authentication with Tidal during a session. This cookie is HTTP-only and secure.
            </p>

            <h3 className="text-accent mb-sm">Your Rights</h3>
            <div className="text-secondary mb-xl">
              <p className="mb-sm">• Disconnect TidePool from your Tidal account anytime via Tidal's settings</p>
              <p className="mb-sm">• Clear your browser's localStorage to remove local preferences</p>
              <p>• Session data is automatically deleted when sessions end</p>
            </div>

            <h3 className="text-accent mb-sm">Contact</h3>
            <p className="text-secondary">
              Questions? Reach out at <a href="mailto:privacy@tidepool.art">privacy@tidepool.art</a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
