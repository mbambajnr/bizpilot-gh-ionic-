import React from 'react';
import { BusinessProfile } from '../data/seedBusiness';

interface DocumentHeaderProps {
  profile: BusinessProfile;
  type: string;
  referenceNumber: string;
  date: string;
}

const DocumentHeader: React.FC<DocumentHeaderProps> = ({ profile, type, referenceNumber, date }) => {
  const bizName = profile?.businessName || 'Business Name';
  const address = profile?.address || 'Address not set';
  const phone = profile?.phone || 'Phone not set';

  return (
    <div className="doc-header-block">
      <div className="header-top-row">
        <div className="biz-identity-group">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="Logo" className="doc-header-logo" />
          )}
          <div className="biz-details">
            <h2 className="biz-name-main">{bizName}</h2>
            <div className="biz-info-stack">
              <p className="biz-info-line">{address}</p>
              <p className="biz-info-line">T: {phone}</p>
              {profile?.website && <p className="biz-info-line">{profile.website}</p>}
            </div>
          </div>
        </div>
        <div className="doc-meta-group">
          <h1 className="doc-type-title">{type}</h1>
          <div className="doc-meta-stack">
            <p className="doc-meta-item"><strong>No:</strong> {referenceNumber}</p>
            <p className="doc-meta-item"><strong>Date:</strong> {date}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentHeader;
