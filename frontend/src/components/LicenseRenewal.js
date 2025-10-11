import React from 'react';

   export default function LicenseRenewal({ daysLeft }) {
     const bankQR = "data:image/png;base64,YOUR_QR_CODE_BASE64";
     const upiId = "yourcompany@upi";
     
     return (
       <div className="license-renewal">
         <h3>License Expires in {daysLeft} days</h3>
         <img src={bankQR} alt="Payment QR" width="200"/>
         <p>UPI: {upiId}</p>
         <p>1 Year: ₹10,000 | 3 Years: ₹25,000 | 5 Years: ₹40,000 | Lifetime: ₹75,000</p>
       </div>
     );
   }