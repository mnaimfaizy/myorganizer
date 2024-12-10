## Generate a JWT Secret Key

```
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```
