const apiUrl = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_API_PROD_URL : process.env.REACT_APP_API_DEV_URL;

const googleApiKey = process.env.NODE_ENV === 'production' ? process.env.GOOGLE_API_KEY_PROD : process.env.GOOGLE_API_KEY_DEV;

const serverPort = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_API_PROD_PORT : process.env.REACT_APP_API_DEV_PORT;

const fb_projectId = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_PROD_FB_PROJECT_ID : process.env.REACT_APP_DEV_FB_PROJECT_ID;

export {
    apiUrl, googleApiKey, serverPort, fb_projectId
};