import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";

// Using the config provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyDUh7LtvUznCE8STn8YPRlSrbPuKIz2ZtE",
  authDomain: "anime-a4c3f.firebaseapp.com",
  projectId: "anime-a4c3f",
  storageBucket: "anime-a4c3f.firebasestorage.app",
  messagingSenderId: "1065538635432",
  appId: "1:1065538635432:web:dab3c183447bef9481649d"
};

// Initialize only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();

export const YOUTUBE_API_KEY = "AIzaSyBp6KnxeONqynFO6GAzsNwzIl09bDOViq8";