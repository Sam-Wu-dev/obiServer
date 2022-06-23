import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, where, query, limit, arrayUnion, updateDoc, doc, getDoc, FieldPath } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBdN8l6jlpa7H-bT-ce3R8PD4VqSyNVCOs",
    authDomain: "obi-chat.firebaseapp.com",
    projectId: "obi-chat",
    storageBucket: "obi-chat.appspot.com",
    messagingSenderId: "284957706614",
    appId: "1:284957706614:web:8826a03413c77db9e4d257"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function getId(email) {
    const q = query(collection(db, "users"),
        where("email", "==", email),
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return false;
    }
    return querySnapshot.docs[0].id;
}

async function signIn(email, password) {
    const q = query(collection(db, "users"),
        where("email", "==", email),
        where("password", "==", password)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return false;
    }
    let user = querySnapshot.docs[0].data();
    user["userId"] = querySnapshot.docs[0].id;
    return user;
}

async function signUp(obj) {
    const q = query(collection(db, "users"),
        where("email", "==", obj.email)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        obj["friend"] = [];
        addDoc(collection(db, "users"), obj);
        return getId(obj.email);
    }
    return false;
}

async function getUsers(email) {
    console.log(email);;
    let qu = query(collection(db, "users"),
        where("email", "==", email),
    );
    let querySnapshott = await getDocs(qu);
    if (querySnapshott.empty) {
        return false;
    }
    let friend = querySnapshott.docs[0].data().friend;
    friend.push("0");
    const q = query(collection(db, "users"),
        where("__name__", "not-in", friend),
        limit(20)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return false;
    }
    let users = [];
    querySnapshot.docs.forEach(doc => {
        let user = doc.data();
        if (user.email != email) {
            user["userId"] = doc.id;
            users.push(user);
        }

    });
    return users;
}

async function messaging(aId, bId, message, timestamp) {
    timestamp = new Date(timestamp);
    let q = query(collection(db, "chatroom"),
        where("A", "==", aId),
        where("B", "==", bId),
    );
    let querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        q = query(collection(db, "chatroom"),
            where("A", "==", bId),
            where("B", "==", aId),
        );
        querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            // chatroom not exist
            const a = doc(db, "users", aId);
            const b = doc(db, "users", bId);
            const aData = await getDoc(a);
            const bData = await getDoc(b);
            addDoc(collection(db, "chatroom"), {
                A: aId,
                B: bId,
                aImage: aData.data().image,
                bImage: bData.data().image,
                aName: aData.data().name,
                bName: bData.data().name,
                messages: [{
                    message: message,
                    timestamp: timestamp,
                    sender: 'A'
                }]
            });
            await updateDoc(a, { friend: arrayUnion(bId) });
            await updateDoc(b, { friend: arrayUnion(aId) });
        } else {
            // chatroom exist and B send message to A
            await updateDoc(querySnapshot.docs[0].ref, {
                messages: arrayUnion({
                    message: message,
                    timestamp: timestamp,
                    sender: 'B'
                })
            });
        }
    } else {
        // chatroom exist and A send message to B
        await updateDoc(querySnapshot.docs[0].ref, {
            messages: arrayUnion({
                message: message,
                timestamp: timestamp,
                sender: 'A'
            })
        });
    }
}

async function getChatRoom(aId, bId) {
    let q = query(collection(db, "chatroom"),
        where("A", "==", aId),
        where("B", "==", bId),
    );
    let querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        q = query(collection(db, "chatroom"),
            where("A", "==", bId),
            where("B", "==", aId),
        );
        querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            const a = doc(db, "users", aId);
            const b = doc(db, "users", bId);
            const aData = await getDoc(a);
            const bData = await getDoc(b);
            let obj = {
                A: aId,
                B: bId,
                aImage: aData.data().image,
                bImage: bData.data().image,
                aName: aData.data().name,
                bName: bData.data().name,
                messages: []
            }
            addDoc(collection(db, "chatroom"), obj);
            await updateDoc(b, { friend: arrayUnion(aId) });
            await updateDoc(a, { friend: arrayUnion(bId) });
            obj["isNew"] = true;
            return obj;
        }
    }
    let obj = querySnapshot.docs[0].data();
    obj["isNew"] = false;
    return querySnapshot.docs[0].data();
}

async function getFriend(id) {
    const client = doc(db, "users", id);
    const clientData = await getDoc(client);
    const friend = clientData.data().friend;
    return friend;
}
export { signIn, signUp, getUsers, messaging, getChatRoom, getFriend };