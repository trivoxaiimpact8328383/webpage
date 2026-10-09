
// bottom.js

document.addEventListener("DOMContentLoaded", function () {

    const quizButton = document.getElementById("trivoxStartQuizButton");

    if (!quizButton) {
        console.error("Start a Quiz button not found!");
        return;
    }

    const API_URL = "https://payment-czhd.onrender.com";

    // Load Razorpay Checkout
    function loadRazorpay() {
        return new Promise((resolve, reject) => {

            if (window.Razorpay) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";

            script.onload = resolve;
            script.onerror = () => reject(
                new Error("Razorpay checkout could not be loaded.")
            );

            document.head.appendChild(script);
        });
    }

    quizButton.addEventListener("click", async function () {

        // Check login
        if (localStorage.getItem("trivoxCourseLoggedIn") !== "true") {
            window.location.href = "course.html";
            return;
        }

        const originalText = quizButton.textContent;

        try {
            quizButton.disabled = true;
            quizButton.textContent = "Please wait...";

            await loadRazorpay();

            // Create Razorpay order
            const orderResponse = await fetch(
                `${API_URL}/api/razorpay/quiz/create-order`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({})
                }
            );

            const order = await orderResponse.json();

            if (!orderResponse.ok || !order.success) {
                throw new Error(
                    order.message || "Unable to create payment order."
                );
            }

            if (!order.key || !order.order_id) {
                throw new Error("Payment order details are missing.");
            }

            // Open Razorpay payment window
            const options = {
                key: order.key,
                amount: order.amount,
                currency: order.currency || "INR",
                name: "TRIVOX",
                description: "Quiz Access",
                order_id: order.order_id,

                handler: async function (payment) {

                    try {
                        quizButton.textContent = "Verifying payment...";

                        // Verify payment on backend
                        const verifyResponse = await fetch(
                            `${API_URL}/api/razorpay/quiz/verify`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    razorpay_payment_id:
                                        payment.razorpay_payment_id,

                                    razorpay_order_id:
                                        payment.razorpay_order_id,

                                    razorpay_signature:
                                        payment.razorpay_signature,

                                    payment_id:
                                        payment.razorpay_payment_id,

                                    order_id:
                                        payment.razorpay_order_id,

                                    signature:
                                        payment.razorpay_signature
                                })
                            }
                        );

                        const result = await verifyResponse.json();

                        if (
                            !verifyResponse.ok ||
                            !result.success ||
                            result.status !== "captured" ||
                            result.quiz_access !== true
                        ) {
                            throw new Error(
                                result.message ||
                                "Payment verification failed."
                            );
                        }

                        // Payment verified: open quiz
                        window.location.href =
                            result.quiz_url || "quiz.html";

                    } catch (error) {
                        console.error("Payment verification error:", error);

                        alert(
                            "Payment verification could not be completed. " +
                            "Please contact support before paying again."
                        );

                        quizButton.disabled = false;
                        quizButton.textContent = originalText;
                    }
                },

                modal: {
                    ondismiss: function () {
                        quizButton.disabled = false;
                        quizButton.textContent = originalText;
                    }
                },

                theme: {
                    color: "#111111"
                }
            };

            const razorpay = new Razorpay(options);

            razorpay.on("payment.failed", function (response) {
                console.error("Payment failed:", response.error);

                alert(
                    response.error.description ||
                    "Payment failed. Please try again."
                );

                quizButton.disabled = false;
                quizButton.textContent = originalText;
            });

            razorpay.open();

        } catch (error) {
            console.error("Quiz payment error:", error);

            alert(
                error.message ||
                "Something went wrong. Please try again."
            );

            quizButton.disabled = false;
            quizButton.textContent = originalText;
        }
    });

});

