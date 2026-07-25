import { Tv, X } from 'lucide-react';

export default function TVSupportModal({ onEnable, onClose }) {
  return (
    <div className="tv-modal-overlay" onClick={onClose}>
      <div className="tv-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="tv-modal-close" onClick={onClose} title="Close">
          <X size={18} />
        </button>

        <div className="tv-modal-icon">
          <Tv size={22} />
        </div>
        <p className="tv-modal-eyebrow">Device check</p>
        <h3 className="tv-modal-title">Your device is TV?</h3>
        <p className="tv-modal-desc">
          If this screen is a TV, turn on <strong>TV Support</strong> to enable
          remote-friendly navigation. If you're on a computer or phone, just close this.
        </p>

        <button className="btn-pill full large" onClick={onEnable}>
          <Tv size={16} /> TV Support
        </button>
        <button className="btn-ghost full" onClick={onClose}>
          <X size={16} /> Close
        </button>
      </div>
    </div>
  );
}
