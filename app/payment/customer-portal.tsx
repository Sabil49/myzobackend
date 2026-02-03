"use client";

    export default function CustomerPortal() {
      const handleOpenPortal = async (customerId: string) => {
        try {
          const response = await fetch('/api/payment/dodo/customer-portal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ customer_id: customerId }),
          });

          const data = await response.json();

          if (data.portal_url) {
            window.open(data.portal_url, '_blank');
          } else {
            alert('Could not open customer portal.');
          }
        } catch (error) {
          console.error('Error opening customer portal:', error);
          alert('An error occurred while trying to open the customer portal.');
        }
      };

      return (
        <button onClick={() => handleOpenPortal("cus_Uqwg3OWPsUR5ftSq7qwHM")}>Manage Subscription</button>
      );
    }
