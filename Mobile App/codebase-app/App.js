import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

// Firebase Config from google-services.json
const firebaseConfig = {
    apiKey: "AIzaSyCqvAqTUWnOnC0A-YtcHcNlS8rta__bavU",
    authDomain: "codebase-83525.firebaseapp.com",
    projectId: "codebase-83525",
    storageBucket: "codebase-83525.firebasestorage.app",
    messagingSenderId: "729735531784",
    appId: "1:729735531784:android:fad3b5ba08488e4ef270bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const { width, height } = Dimensions.get('window');

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "729735531784-k35el19cfoph90jt2iuc9s3hngbv1mqi.apps.googleusercontent.com",
    webClientId: "729735531784-k35el19cfoph90jt2iuc9s3hngbv1mqi.apps.googleusercontent.com", // Often used for Expo Go
  });

  useEffect(() => {
    ScreenOrientation.unlockAsync();
    
    // Check for existing session
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential);
    }
  }, [response]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // If NOT logged in, show provide a premium Login Screen
  if (!user) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.loginContainer}>
        <StatusBar style="light" />
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                <Text style={styles.logoText}>CB</Text>
            </View>
            <Text style={styles.brandTitle}>CodeBase</Text>
            <Text style={styles.subtitle}>Your Secure Learning Ecosystem</Text>
        </View>

        <View style={styles.footer}>
            <Text style={styles.welcomeText}>Welcome back, student!</Text>
            <TouchableOpacity 
                style={styles.googleBtn} 
                disabled={!request}
                onPress={() => promptAsync()}
            >
                <Image source={{ uri: 'https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png' }} style={styles.gIcon} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>Only @std.uwu.ac.lk or @stu.vau.ac.lk accounts</Text>
        </View>
      </LinearGradient>
    );
  }

  // If logged in, show the WebView
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <View style={styles.webviewWrapper}>
        <WebView 
          source={{ uri: 'https://unicodebase.vercel.app/loading.html' }}
          style={styles.webview}
          userAgent="Mozilla/5.0 (Linux; Android 10; Android SDK built for x86) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsBackForwardNavigationGestures={true}
          allowsFullscreenVideo={true}
          mixedContentMode="always"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loginContainer: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: height * 0.15,
    alignItems: 'center',
  },
  logoContainer: {
      width: 80,
      height: 80,
      borderRadius: 24,
      background: 'linear-gradient(45deg, #6366f1, #ec4899)', // not supported on RN directly, use style
      backgroundColor: '#6366f1',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      shadowColor: '#6366f1',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
  },
  logoText: {
      color: 'white',
      fontSize: 32,
      fontWeight: '900',
  },
  brandTitle: {
    color: 'white',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 8,
  },
  footer: {
      marginBottom: 40,
  },
  welcomeText: {
      color: 'white',
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 24,
      textAlign: 'center',
  },
  googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'white',
      paddingVertical: 16,
      borderRadius: 20,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
  },
  gIcon: {
      width: 24,
      height: 24,
  },
  googleBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f172a',
  },
  disclaimer: {
      color: '#64748b',
      fontSize: 12,
      marginTop: 20,
      textAlign: 'center',
  },
  webviewWrapper: {
    flex: 1,
    marginTop: 35,
  },
  webview: {
    flex: 1,
  },
});
