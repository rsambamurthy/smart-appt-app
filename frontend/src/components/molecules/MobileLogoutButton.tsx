import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCredentials } from '../../features/auth/authSlice';
import { useLogoutMutation } from '../../store/api/authApi';
import { baseApi } from '../../store/api/baseApi';
import LogoutIcon from '../atoms/LogoutIcon';

/**
 * Logout for the mobile tab-root screens.
 *
 * Home, Visitors and More draw their own gradient headers instead of using
 * PageSubHeader, so the logout icon added there never reached them — and Home
 * is the first place anyone looks. This sits in the top-right of those
 * headers, over the gradient, hence the translucent white styling.
 *
 * The header needs position: relative for this to anchor to it.
 */
export default function MobileLogoutButton() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    // The local session is cleared whether or not the server call lands. A
    // gate phone on bad signal must still be able to sign out.
    try { await logout(undefined).unwrap(); } catch { /* ignore */ }
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return (
    <button
      onClick={handleLogout}
      title="Logout"
      aria-label="Logout"
      style={{
        position: 'absolute',
        top: 'max(46px, calc(env(safe-area-inset-top) + 14px))',
        right: 16,
        width: 40, height: 40, borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.22)',
        border: 'none', cursor: 'pointer', lineHeight: 1,
        color: '#fff', padding: 0,
      }}
    >
      <LogoutIcon size={19} />
    </button>
  );
}
