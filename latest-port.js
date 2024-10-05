import nacl from "tweetnacl";
import bs58 from "bs58";
import { sha256 } from "js-sha256";

class PoRT {
  constructor(initParams = {}) {
    this.trustedNodeAddress =
      initParams.trustedNodeAddress || "https://k2-tasknet.koii.live";
    console.log(this);
    this.propagationCount = initParams.propagationCount || 3;
    this.namespaceId = initParams.namespaceId || "Attention";
    this.walletLocation = initParams.walletLocation || "k2-wallet";
    this.ignoreRejection = initParams.ignoreRejection || false;
    this.connectionWait = initParams.connectionWait || false;
    this.initialized = this.initialize();
    this.nodes = [];
  }

  initialize() {
    return this.getListOfAllNodes();
  }

  getListOfAllNodes() {
    return new Promise((resolve, reject) => {
      fetch(this.trustedNodeAddress + "/nodes/Attention22222222222222222222222222222222222")
        .then((res) => res.json())
        .then(async (res) => {
          res.push({
            data: {
              url: this.trustedNodeAddress,
            },
          });
          const validNodes = await this.getNodesRunningAttentionGame(res);
          this.nodes = validNodes;
          console.log(validNodes);
          resolve();
        })
        .catch((e) => {
          this.nodes = [];
          console.error(e);
          reject(e);
        });
    });
  }

  async propagatePoRT(id) {
    await this.initialized;
    let headers = await this.signPort(id);
    if (headers) {
      for (let i = 0; i < this.nodes.length; i++) {
        fetch(`${this.nodes[i]}/attention/submit-ports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(headers),
        })
          .then((res) => res.json())
          .then(console.log)
          .catch(console.log);
      }
    }
  }

  async getNodesRunningAttentionGame(nodes) {
    const nodesRunningAttentionGame = [];
    for (let i = 0; i < nodes.length; i++) {
      const response = await this.checkNodeAttentionGame(nodes[i]["data"]["url"]);
      if (response) nodesRunningAttentionGame.push(nodes[i]["data"]["url"]);
    }
    return nodesRunningAttentionGame;
  }

  checkNodeAttentionGame(node) {
    return new Promise((resolve) => {
      if (node.includes("localhost") || node.includes("<")) {
        return resolve(false);
      }
      fetch(`${node}/attention/id`)
        .then((res) => {
          if (res.status !== 200) return resolve(false);
          return resolve(true);
        })
        .catch((e) => {
          console.log(e);
          return resolve(false);
        });
    });
  }

  async signPort(id) {
    await this.initialized;
    let Ports;
    if (window && window.koiiWallet && window.koiiWallet.signK2Port) {
      const response = await window.koiiWallet.signPort(id);
      Ports = response.data;
      console.log(`%c ${JSON.stringify(response)}`, "color: green");
      if (response.status == 200) return response.data;
    }
    if (localStorage.getItem(this.walletLocation)) {
      const wallet = nacl.sign.keyPair.fromSecretKey(
        new Uint8Array(JSON.parse(localStorage.getItem(this.walletLocation)))
      );
      Ports = await this.generatePoRTHeaders(wallet, id);
      return Ports;
    } else {
      try {
        const wallet = nacl.sign.keyPair();
        localStorage.setItem(
          this.walletLocation,
          JSON.stringify(Array.from(wallet.secretKey))
        );
        Ports = await this.generatePoRTHeaders(wallet, id);
        return Ports;
      } catch (e) {
        console.log(e);
      }
    }
  }

  async generatePoRTHeaders(wallet, contentId) {
    try {
      let nonce = 0;
      const payload = {
        resource: contentId,
        timestamp: new Date().valueOf(),
        nonce,
        scheme: "AR",
        epoch: -1,
      };
      let signedMessage;
      for (;;) {
        const msg = new TextEncoder().encode(JSON.stringify(payload));
        payload.nonce++;
        signedMessage = nacl.sign(msg, wallet.secretKey);
        const hash = sha256(encodePublicKey(signedMessage));
        if (this.difficultyFunction(hash)) {
          break;
        }
        nonce++;
      }
      const data = {
        signedMessage: encodePublicKey(signedMessage),
        publicKey: encodePublicKey(wallet.publicKey),
      };
      return data;
    } catch (e) {
      console.log(e);
      throw {
        name: "Generic Error",
        description: "Something went wrong while generating headers",
      };
    }
  }

  difficultyFunction(hash) {
    return hash.startsWith("00");
  }
}

function encodePublicKey(publicKey) {
  return bs58.encode(publicKey);
}

export default PoRT;
