'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { loginAuth } from '@/features/auth/api/login';
import { Eye, EyeOff, Loader2, AlertCircle, User, Lock, LogIn, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

const LoginPageClient = () => {
const { login, token, isLoading: isAuthLoading } = useAuth();
const router = useRouter();

const [username, setUsername] = useState('');
const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [rememberMe, setRememberMe] = useState(false);
const [error, setError] = useState('');
const [isSubmitLoading, setIsSubmitLoading] = useState(false);
const [isForgotOpen, setIsForgotOpen] = useState(false);

useEffect(() => {
// Nếu app đã load auth xong và phát hiện có token, tự động đẩy về Dashboard
if (!isAuthLoading && token) {
  router.replace('/');
}
}, [isAuthLoading, token, router]);

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setError('');
setIsSubmitLoading(true);

try {
  const res = await loginAuth({ username, password, deviceType: 'WEB' });
  
  if (res && res.access_token) {
    login(res.access_token, res.refresh_token, rememberMe);
  } else {
    throw new Error('Dữ liệu đăng nhập không hợp lệ');
  }
} catch (err: any) {
  console.error('[LoginPage] Login failed:', err);
  // Hiển thị thông báo lỗi chi tiết từ server nếu có
  setError(err.message || 'Tên đăng nhập hoặc mật khẩu không đúng');
} finally {
  setIsSubmitLoading(false);
}
};

// Nếu đang kiểm tra token hoặc đã có token rồi (chuẩn bị redirect đi), sẽ hiện màn hình xoay để tránh chớp giật giao diện cũ
if (isAuthLoading || token) {
return (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FE]">
    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
    <p className="text-slate-500 text-sm font-medium">Đang chuyển hướng...</p>
  </div>
);
}

return (
<div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7FE] relative overflow-hidden py-4 px-4 sm:px-6">
  {/* Background radial gradients for subtle light theme texture */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[100px]" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-[100px]" />
  </div>

  <div className="relative z-10 w-full max-w-[340px] sm:max-w-[380px]">
    {/* Main Card */}
    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">

      {/* Logo */}
      <div className="flex justify-center items-center h-10 sm:h-12 w-full mb-3 relative">
        <img
          src="/images/vtex-logo.png"
          alt="VTEX Logo"
          className="absolute w-[200px] sm:w-[220px] h-auto object-contain scale-50"
        />
      </div>

      <div className="text-center mb-5 sm:mb-6">
        <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-900 mb-1 tracking-tight">
          RFID Inventory Manager
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm">
          Hệ thống quản lý kho chính xác
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl mb-5 text-sm font-medium border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        {/* Username Input */}
        <div>
          <label className="block text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Tên đăng nhập
          </label>
          <div className="relative group">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nhập tài khoản quản trị"
              autoFocus
              required
              className="w-full pl-9 pr-4 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-md sm:rounded-lg text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-[11px] sm:text-xs"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Mật khẩu
            </label>
            <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[9px] sm:text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors">
              Quên mật khẩu?
            </button>
          </div>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-9 pr-9 py-1.5 sm:py-2 bg-white border border-slate-200 rounded-md sm:rounded-lg text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium tracking-widest text-[11px] sm:text-xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div className="flex items-center gap-2 pt-1">
          <label className="relative flex cursor-pointer items-center rounded-full">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="peer h-4 w-4 cursor-pointer appearance-none rounded-full border border-slate-300 transition-all checked:border-primary checked:bg-primary"
            />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
              </svg>
            </div>
          </label>
          <span className="text-xs sm:text-sm font-medium text-slate-600 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
            Ghi nhớ đăng nhập
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitLoading || !username || !password}
          className="w-full py-1.5 sm:py-2 bg-primary hover:bg-[#000A5C] text-white font-semibold rounded-md sm:rounded-lg text-[11px] sm:text-xs transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-0.5 shadow-[0_4px_14px_rgba(0,15,138,0.25)]"
        >
          {isSubmitLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              Đăng nhập <LogIn className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </button>
      </form>

      {/* Card Footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-[11px] font-medium">Hệ thống bảo mật đầu cuối (SSL 256-bit)</span>
        </div>
      </div>
    </div>

    {/* Out-of-card Footer */}
    <div className="text-center mt-4 sm:mt-5 text-[10px] sm:text-xs font-medium text-slate-400 px-2 leading-relaxed">
      © {new Date().getFullYear()} Inventory Pro. Một sản phẩm của Precision Curator Logistics.
    </div>
  </div>

  {/* Forgot Password Modal */}
  {isForgotOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsForgotOpen(false)} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl scale-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-4 mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Hệ Sinh Thái Nội Bộ</h3>
        <p className="text-slate-500 text-sm text-center mb-6 leading-relaxed">
          Đây là hệ thống quản lý kho khép kín. Nếu bạn quên mật khẩu, vui lòng liên hệ trực tiếp với <strong className="text-slate-700">Quản trị viên (Admin)</strong> để được cấp lại mật khẩu mới.
        </p>
        <button
          onClick={() => setIsForgotOpen(false)}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors text-sm"
        >
          Tôi đã hiểu
        </button>
      </div>
    </div>
  )}
</div>
);
};

export default LoginPageClient;
