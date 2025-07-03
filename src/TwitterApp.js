import React, { useEffect, useState, useCallback } from "react";
import Web3 from "web3";
import twitterABI from "./abi/twitterABI.json";
import profileABI from "./abi/profileABI.json";

const TWITTER_CONTRACT_ADDRESS = "0xEDfdeD8697bd95d92Ff981C44472C4f7F3317C28";
const PROFILE_CONTRACT_ADDRESS = "0x1D13f2eD62486a3f12F5D45481931cfd1DCc7Db6";

const TwitterApp = () => {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [twitterContract, setTwitterContract] = useState(null);
  const [profileContract, setProfileContract] = useState(null);
  const [tweet, setTweet] = useState("");
  const [tweets, setTweets] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  const initializeContracts = useCallback(async (acct) => {
    const _web3 = new Web3(window.ethereum);
    const _twitter = new _web3.eth.Contract(twitterABI, TWITTER_CONTRACT_ADDRESS);
    const _profile = new _web3.eth.Contract(profileABI, PROFILE_CONTRACT_ADDRESS);

    setWeb3(_web3);
    setTwitterContract(_twitter);
    setProfileContract(_profile);
    setAccount(acct);

    setTweets([]);
    setTweet("");
    setDisplayName("");
    setBio("");
    setIsRegistered(false);

    try {
      const profile = await _profile.methods.getProfile(acct).call();
      if (profile.displayName && profile.displayName !== "") {
        setDisplayName(profile.displayName);
        setIsRegistered(true);
      }
    } catch (err) {
      console.error("Could not fetch profile:", err);
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("MetaMask not detected");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length === 0) return;
      await initializeContracts(accounts[0]);
    } catch (err) {
      console.error("Error connecting wallet:", err);
    }
  }, [initializeContracts]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        setAccount(null);
        setDisplayName("");
        setIsRegistered(false);
        setProfileContract(null);
        setTwitterContract(null);
        setTweets([]);
        return;
      }
      await initializeContracts(accounts[0]);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [initializeContracts]);

  const registerProfile = async () => {
    setLoading(true);
    await profileContract.methods.setProfile(displayName, bio).send({ from: account });
    alert("Profile registered!");
    setIsRegistered(true);
    setLoading(false);
  };

  const postTweet = async () => {
    setLoading(true);
    await twitterContract.methods.createtweet(tweet).send({ from: account });
    setTweet("");
    await fetchTweets();
    setLoading(false);
  };

  const fetchTweets = async () => {
    setLoading(true);
    const allTweets = await twitterContract.methods.getalltweets(account).call();

    const tweetsWithNames = await Promise.all(
      allTweets.map(async (t) => {
        let username = "Unknown";
        try {
          const profile = await profileContract.methods.getProfile(t.user).call();
          if (profile.displayName) username = profile.displayName;
        } catch {}
        return { ...t, username };
      })
    );

    setTweets(tweetsWithNames);
    setLoading(false);
  };

  const likeTweet = async (id) => {
    setLoading(true);
    await twitterContract.methods.likeTweet(account, id).send({ from: account });
    await fetchTweets();
    setLoading(false);
  };

  const unlikeTweet = async (id) => {
    setLoading(true);
    await twitterContract.methods.unlikeTweet(account, id).send({ from: account });
    await fetchTweets();
    setLoading(false);
  };

  const deleteTweet = async (id) => {
    setLoading(true);
    await twitterContract.methods.deleteTweet(id).send({ from: account });
    await fetchTweets();
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Twitter DApp</h1>
      <p style={styles.subHeader}>On-chain tweets. Powered by Ethereum 💙</p>

      {!account ? (
        <div style={{ textAlign: "center" }}>
          <button onClick={connectWallet} style={styles.button}>🔐 Connect Wallet</button>
        </div>
      ) : (
        <p style={{ textAlign: "center", fontWeight: "bold", color: "#004080" }}>
          Connected as: {displayName || `${account.slice(0, 6)}...${account.slice(-4)}`}
        </p>
      )}

      {account && !isRegistered && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📝 Register Profile</h2>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display Name" style={styles.input} />
          <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" style={styles.input} />
          <button onClick={registerProfile} style={styles.button} disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </div>
      )}

      {account && isRegistered && (
        <>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>✍️ Create Tweet</h2>
            <textarea value={tweet} onChange={(e) => setTweet(e.target.value)} placeholder="What's happening?" style={styles.textarea} />
            <button onClick={postTweet} style={styles.button} disabled={loading}>
              {loading ? "Tweeting..." : "Tweet"}
            </button>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📜 Your Tweets</h2>
            <button onClick={fetchTweets} style={styles.button}>Refresh</button>
            {tweets.map((t, i) => (
              <div key={i} style={styles.tweetBox}>
                <p><strong>@{t.username || "Anonymous"}</strong><br />{t.tweetmessage}</p>
                <p>❤️ {t.likes}</p>
                <p>🕒 {new Date(Number(t.timestamp) * 1000).toLocaleString()}</p>
                <button onClick={() => likeTweet(t.id)} style={styles.smallButton}>Like</button>
                <button onClick={() => unlikeTweet(t.id)} style={styles.smallButton}>Unlike</button>
                <button onClick={() => deleteTweet(t.id)} style={{ ...styles.smallButton, backgroundColor: "#ff4d4d" }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "700px",
    margin: "50px auto",
    padding: "30px",
    fontFamily: "'Segoe UI', sans-serif",
    backgroundColor: "#f9faff",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    borderRadius: "15px",
  },
  header: {
    textAlign: "center",
    fontSize: "2.5rem",
    color: "#004080",
    marginBottom: "10px",
  },
  subHeader: {
    textAlign: "center",
    fontSize: "1rem",
    color: "#888",
    marginBottom: "20px",
  },
  section: {
    marginTop: "25px",
    backgroundColor: "#fff",
    border: "1px solid #dbe2ef",
    padding: "20px",
    borderRadius: "10px",
  },
  sectionTitle: {
    color: "#004080",
  },
  input: {
    width: "100%",
    padding: "10px",
    margin: "8px 0",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  textarea: {
    width: "100%",
    height: "80px",
    padding: "10px",
    margin: "8px 0",
    borderRadius: "5px",
    border: "1px solid #ccc",
    resize: "none",
  },
  button: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
  },
  smallButton: {
    marginRight: "10px",
    padding: "6px 12px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#007bff",
    color: "white",
    marginTop: "5px",
  },
  tweetBox: {
    backgroundColor: "#f0f4ff",
    padding: "15px",
    marginTop: "15px",
    borderRadius: "6px",
  },
};

export default TwitterApp;
