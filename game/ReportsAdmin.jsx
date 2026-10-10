import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Check, X, Flag, Ban, ShieldAlert } from 'lucide-react';
import { ROLE_HIERARCHY } from '@/lib/constants';
import { adminUpdateProfile } from '@/lib/adminAction';

export default function ReportsAdmin({ adminProfile }) {
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(false);
  const canBan = ROLE_HIERARCHY[adminProfile?.role] >= ROLE_HIERARCHY.admin;

  const load = () =>
    base44.entities.Report.filter({ status: 'pending' }, '-created_date')
      .then(setReports)
      .catch(() => setReports([]));

  useEffect(() => {
    load();
    const unsub = base44.entities.Report.subscribe((e) => {
      if (e.type === 'create' || e.type === 'update' || e.type === 'delete') load();
    });
    return unsub;
  }, []);

  const banTarget = async (report) => {
    if (busy) return;
    setBusy(true);
    try {
      if (canBan) {
        const profiles = await base44.entities.PlayerProfile.filter({ user_id: report.target_user_id });
        if (profiles[0]) {
          await adminUpdateProfile(adminProfile, profiles[0], { is_banned: true });
        }
        await base44.entities.Report.update(report.id, {
          status: 'reviewed',
          reviewer_id: adminProfile.user_id,
          reviewer_username: adminProfile.username,
          reviewer_action: 'banned',
        });
      } else {
        await base44.entities.BanRequest.create({
          target_user_id: report.target_user_id,
          target_username: report.target_username,
          requester_id: adminProfile.user_id,
          requester_username: adminProfile.username,
          reason: `Player report: ${report.reason}`,
          proof: report.proof,
          status: 'pending',
        });
        await base44.entities.Report.update(report.id, {
          status: 'reviewed',
          reviewer_id: adminProfile.user_id,
          reviewer_username: adminProfile.username,
          reviewer_action: 'ban_requested',
        });
      }
      load();
    } catch (e) {
      alert('Failed: ' + (e.message || 'service unavailable'));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (report) => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.Report.update(report.id, {
        status: 'dismissed',
        reviewer_id: adminProfile.user_id,
        reviewer_username: adminProfile.username,
        reviewer_action: 'dismissed',
      });
      load();
    } catch (e) {
      alert('Failed: ' + (e.message || 'unknown'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-display text-[#a7fcc9] mb-2 flex items-center gap-2">
        <Flag size={16} /> Player Reports
        {reports.length > 0 && (
          <span className="bg-red-500 text-white text-[10px] rounded-full px-2">{reports.length}</span>
        )}
      </h3>
      {reports.length === 0 && <p className="text-white/60 text-xs">No pending reports.</p>}
      {reports.map((report) => (
        <div key={report.id} className="bg-panel rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display text-sm text-white">🎯 {report.target_username}</span>
            <span className="text-[10px] text-white/60">reported by {report.reporter_username}</span>
          </div>
          <p className="text-xs text-white/80 mb-1">
            <span className="text-white/50">Reason:</span> {report.reason}
          </p>
          {report.proof && (
            <p className="text-xs text-white/80 mb-2 break-words">
              <span className="text-white/50">Proof:</span> {report.proof}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => banTarget(report)}
              disabled={busy}
              className="text-xs"
              style={{ backgroundColor: '#ef4444', color: '#fff' }}
            >
              {canBan ? (
                <><Ban size={12} className="mr-1" />Ban User</>
              ) : (
                <><ShieldAlert size={12} className="mr-1" />Request Ban</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dismiss(report)}
              disabled={busy}
              className="text-xs border-white/20 text-white"
            >
              <X size={12} className="mr-1" />Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}