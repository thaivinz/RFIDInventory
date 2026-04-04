import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { User, Lock, Fingerprint, Scan, Eye, EyeOff } from 'lucide-react-native';
import { loginApi } from '../api/login';
import { API_URL } from '../../../shared/api/config';
import { NetworkError } from '../../../shared/api/errors';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore(state => state.login);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập tài khoản và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const response: any = await loginApi({ username, password, deviceType: 'MOBILE' });
      
      // Backend wrap response: { success: true, message: '...', data: { access_token, ... } }
      const authData = response.data || response;
      const token = authData.access_token;
      const role = authData.user?.role || null;

      if (token) {
        login(token, username, role);
      } else {
        throw new Error('Không nhận được token từ server');
      }
    } catch (error: any) {
      console.error('[LoginScreen] Error:', error);
      
      let title = 'Đăng nhập thất bại';
      let message = error.message || 'Lỗi không xác định';

      if (error instanceof NetworkError) {
        message = `Không kết nối được tới server.\nAPI: ${API_URL}\nHãy kiểm tra EXPO_PUBLIC_API_URL hoặc IP LAN của máy chạy backend.`;
      } else if (error.data && error.data.message) {
        // Lỗi từ backend (ApiError) gửi về
        message = error.data.message;
      }

      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>

        {/* Header & Logo Section */}
        <View style={styles.headerSection}>
          <Image
            source={require('../../../../assets/vtex_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>RFID Inventory</Text>
            <Text style={styles.subtitle}>Quản lý Kho Thông minh</Text>
          </View>
        </View>

        {/* Main Form Section */}
        <View style={styles.formSection}>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>TÊN ĐĂNG NHẬP</Text>
            <View style={styles.inputBox}>
              <User size={18} color="#94A3B8" style={{ marginLeft: 16 }} />
              <TextInput
                style={styles.input}
                placeholder="Nhập tên đăng nhập"
                placeholderTextColor="rgba(119, 117, 135, 0.5)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.inputLabel}>MẬT KHẨU</Text>
              <TouchableOpacity>
                <Text style={styles.forgotLink}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputBox}>
              <Lock size={18} color="#94A3B8" style={{ marginLeft: 16 }} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="rgba(119, 117, 135, 0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 16 }}>
                {showPassword ? (
                  <EyeOff size={18} color="#94A3B8" />
                ) : (
                  <Eye size={18} color="#94A3B8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer / Biometric Section */}
        <View style={styles.footerSection}>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>TRUY CẬP AN TOÀN</Text>
            <View style={styles.divider} />
          </View>

          <View style={{ alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.bioBtn}>
              <Fingerprint size={28} color="#3525CD" />
            </TouchableOpacity>
            <Text style={styles.bioText}>VÂN TAY</Text>
          </View>

          <View style={styles.modeContainer}>
            <Text style={styles.modeLabel}>Phiên bản:</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>RFID_v4.2.0</Text>
            </View>
          </View>

        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },

  headerSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  logoImage: {
    width: 200,
    height: 80,
    marginBottom: 8,
  },
  titleWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#191C1E',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#464555',
  },

  formSection: {
    gap: 16,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#464555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  forgotLink: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3525CD',
    marginRight: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(199, 196, 216, 0.25)',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#191C1E',
  },
  loginBtn: {
    backgroundColor: '#3525CD',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3525CD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  loginBtnDisabled: {
    backgroundColor: 'rgba(53, 37, 205, 0.5)',
    shadowOpacity: 0,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  footerSection: {
    marginTop: 16,
    alignItems: 'center',
    gap: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(199, 196, 216, 0.3)',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#777587',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bioBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(199, 196, 216, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bioText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#464555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  modeLabel: {
    fontSize: 12,
    color: '#464555',
  },
  modeBadge: {
    backgroundColor: '#ECEEF0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#464555',
  },
});
