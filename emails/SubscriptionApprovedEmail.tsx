import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
    Tailwind,
} from "@react-email/components"

interface SubscriptionApprovedEmailProps {
    cafeName: string
    cafeSlug: string
    ownerName?: string
    tier: "Pro" | "Premium"
}

// Custom Tailwind config with Grounds colors (matching global.css)
const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: "#74512d",
                secondary: "#af8f6f",
                tertiary: "#f8f4e1",
                background: "#f8f4e1",
                text: "#543310",
            },
        },
    },
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://grounds.ph"

export default function SubscriptionApprovedEmail({
    cafeName,
    cafeSlug,
    ownerName,
    tier,
}: SubscriptionApprovedEmailProps) {
    const cafeUrl = `${baseUrl}/cafes/${cafeSlug}`
    const dashboardUrl = `${baseUrl}/owner/cafes/${cafeSlug}`

    return (
        <Html>
            <Preview>
                {`Your ${tier} subscription for "${cafeName}" has been activated!`}
            </Preview>
            <Tailwind config={tailwindConfig}>
                <Head />
                <Body className='bg-tertiary font-sans'>
                    <Container className='mx-auto py-12 px-4 max-w-xl'>
                        {/* Header */}
                        <Section className='text-center mb-8'>
                            <Heading className='text-4xl font-bold text-primary font-serif m-0'>
                                Grounds
                                <span className='text-secondary'>.</span>
                            </Heading>
                        </Section>

                        {/* Main Card */}
                        <Section className='bg-white rounded-2xl p-8 shadow-lg'>
                            <Heading className='text-2xl font-semibold text-text mt-0 mb-4'>
                                🎉 Your {tier} Subscription is Active!
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {ownerName ? `Hey ${ownerName},` : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Great news! Your payment for{" "}
                                <strong>{cafeName}</strong> has been verified
                                and your <strong>{tier}</strong> subscription is
                                now active.
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                You now have access to all {tier} features
                                including:
                            </Text>

                            <ul className='text-text text-base leading-relaxed pl-5'>
                                {tier === "Premium" ? (
                                    <>
                                        <li>Verified badge on your cafe</li>
                                        <li>Menu management</li>
                                        <li>Analytics dashboard</li>
                                        <li>Blog & Events management</li>
                                        <li>Priority ranking</li>
                                    </>
                                ) : (
                                    <>
                                        <li>Verified badge on your cafe</li>
                                        <li>Menu management</li>
                                        <li>Analytics dashboard</li>
                                        <li>Blog publishing</li>
                                    </>
                                )}
                            </ul>

                            <Section className='text-center my-8'>
                                <Button
                                    href={dashboardUrl}
                                    className='bg-primary text-white font-semibold py-3 px-6 rounded-lg no-underline'
                                >
                                    Go to Dashboard
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm'>
                                Thank you for supporting Grounds! Your
                                subscription helps us maintain and improve the
                                platform for all coffee lovers.
                            </Text>
                        </Section>

                        {/* Footer */}
                        <Section className='text-center mt-8'>
                            <Hr className='border-secondary my-6' />
                            <Text className='text-secondary text-sm m-0'>
                                © {new Date().getFullYear()} Grounds. All rights
                                reserved.
                            </Text>
                            <Text className='text-secondary text-xs mt-2'>
                                You received this email because you upgraded
                                your cafe subscription on Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
