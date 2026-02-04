import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../services/firebase';
import { Icon } from './Icon';

interface LoginProps {
  onLoginSuccess: () => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, setIsLoading }) => {
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, loginUsername, loginPassword);
      onLoginSuccess();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background-light dark:bg-background-dark max-w-[480px] mx-auto shadow-2xl">
      <div className="w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="size-24 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-6">
            <Icon name="eco" className="text-6xl" filled />
          </div>
          <h1 className="text-4xl font-black text-primary-dark dark:text-primary mb-2">زراعتي</h1>
          <p className="text-[#61896f] dark:text-[#a3c3ad] font-medium">خطوتك الأولى نحو عالم الزراعة المنزلية الممتع</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white dark:bg-[#1a2e1f] p-8 rounded-[2.5rem] shadow-xl border border-primary/10 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2 mr-2 text-right">البريد الإلكتروني</label>
              <div className="relative">
                <Icon name="person" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-primary text-right"
                  placeholder="أدخل بريدك الإلكتروني"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2 mr-2 text-right">كلمة المرور</label>
              <div className="relative">
                <Icon name="lock" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 pr-12 focus:ring-2 focus:ring-primary text-right"
                  placeholder="أدخل كلمة المرور"
                  required
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95"
          >
            تسجيل الدخول
          </button>

          <div className="text-center">
            <p className="text-xs text-gray-400">
              استخدم <span className="font-bold text-primary">admin@example.com</span> للدخول كمعلم
              <br />
              وكلمة المرور: <span className="font-bold text-primary">123456</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
