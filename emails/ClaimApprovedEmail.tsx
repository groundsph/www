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

interface ClaimApprovedEmailProps {
    cafeName: string
    cafeSlug: string
    ownerName?: string
}

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

export default function ClaimApprovedEmail({
    cafeName,
    cafeSlug,
    ownerName,
}: ClaimApprovedEmailProps) {
    const cafeUrl = `${baseUrl}/cafes/${cafeSlug}`
    const dashboardUrl = `${baseUrl}/owner`

    return (
        <Html>
            <Preview>
                {`Your ownership claim for "${cafeName}" has been approved!`}
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
                                🎉 Claim Approved!
                            </Heading>

                            <Text className='text-text text-base leading-relaxed'>
                                {ownerName ? `Hey ${ownerName},` : "Hello,"}
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                Great news! Your ownership claim for{" "}
                                <strong>{cafeName}</strong> has been verified
                                and approved. You now have full access to manage
                                your cafe&apos;s listing on Grounds!
                            </Text>

                            <Text className='text-text text-base leading-relaxed'>
                                As a verified owner, you can:
                            </Text>

                            <ul className='text-text text-base leading-relaxed'>
                                <li>Update your cafe&apos;s information</li>
                                <li>Respond to customer reviews</li>
                                <li>Share your cafe&apos;s story</li>
                                <li>Get a verified badge on your listing</li>
                            </ul>

                            <Section className='text-center my-8'>
                                <Button
                                    href={dashboardUrl}
                                    className='bg-primary text-white font-semibold py-3 px-6 rounded-lg no-underline'
                                >
                                    Go to Owner Dashboard
                                </Button>
                            </Section>

                            <Section className='text-center mb-4'>
                                <Button
                                    href={cafeUrl}
                                    className='bg-secondary text-white font-semibold py-2 px-4 rounded-lg no-underline text-sm'
                                >
                                    View Your Cafe
                                </Button>
                            </Section>

                            <Text className='text-secondary text-sm'>
                                Welcome to the Grounds community of cafe owners!
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
                                You received this email because you claimed
                                ownership of a cafe on Grounds.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}
